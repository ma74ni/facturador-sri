import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  // Sin credenciales por defecto: solo el login con "mantener la sesión", /auth/refresh y
  // /auth/logout las envían. La API solo acepta credenciales de orígenes exactos con https; si
  // todas las peticiones las llevaran, una vista previa de Netlify no podría ni iniciar sesión.
});

/**
 * "Mantener la sesión iniciada" está disponible en este despliegue. Las vistas previas de
 * Netlify lo desactivan (NEXT_PUBLIC_KEEP_SESSION=false): la API no les acepta la cookie.
 */
export const KEEP_SESSION_AVAILABLE = process.env.NEXT_PUBLIC_KEEP_SESSION !== 'false';

/**
 * "Mantener la sesión iniciada": hay una cookie de renovación en este navegador. Es solo una
 * marca para saber si vale la pena intentar renovar; el token de renovación nunca lo ve JS.
 */
export const SESSION_KEPT_KEY = 'sessionKept';

/** Cabecera que exige la API en /auth/refresh y /auth/logout (protección CSRF). */
const SESSION_HEADER = { 'X-Facturador-Session': '1' };

/** La renovación falló porque la sesión ya no vale (no por la red o el servidor). */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sesión vencida');
  }
}

let refreshing: Promise<string> | null = null;

/** El usuario (`sub`) de un JWT, sin verificarlo: solo para compararlo con el guardado. */
function tokenSubject(token: string): string | undefined {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { sub?: string }).sub;
  } catch {
    return undefined;
  }
}

/**
 * Pide un token de acceso nuevo con la cookie de renovación. Una sola petición a la vez: si
 * varias llamadas reciben 401 juntas, todas esperan la misma renovación.
 *
 * - Sesión vencida o cerrada (401/400): lanza `SessionExpiredError`.
 * - Red caída o servidor despertando: lanza el error original y la sesión sigue.
 */
export function refreshSession(): Promise<string> {
  if (!refreshing) {
    refreshing = axios
      .post<{ access_token: string }>(
        `${apiClient.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true, headers: SESSION_HEADER },
      )
      .then(({ data }) => {
        // Nunca seguir como otra persona: el token renovado debe ser del usuario de esta sesión.
        const savedUser = localStorage.getItem('user');
        const savedId = savedUser ? (JSON.parse(savedUser) as { id?: string }).id : undefined;
        if (savedId && tokenSubject(data.access_token) !== savedId) {
          throw new SessionExpiredError();
        }
        localStorage.setItem('token', data.access_token);
        return data.access_token;
      })
      .catch((error: AxiosError | SessionExpiredError) => {
        if (error instanceof SessionExpiredError) {
          localStorage.removeItem(SESSION_KEPT_KEY);
          throw error;
        }
        const status = error.response?.status;
        if (status === 401 || status === 400) {
          localStorage.removeItem(SESSION_KEPT_KEY);
          throw new SessionExpiredError();
        }
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Cierra la sesión en la API (revoca la cookie). Si falla, la sesión local se cierra igual. */
export async function endSession(): Promise<void> {
  // Siempre: otra pestaña pudo borrar la marca y la cookie seguiría valiendo en el servidor.
  localStorage.removeItem(SESSION_KEPT_KEY);
  try {
    await axios.post(
      `${apiClient.defaults.baseURL}/auth/logout`,
      {},
      { withCredentials: true, headers: SESSION_HEADER },
    );
  } catch {
    // La cookie vence sola; no bloquear el cierre de sesión por la red.
  }
}

/** Borra la sesión de este navegador y vuelve al login. */
function goToLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem(SESSION_KEPT_KEY);
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

// Interceptor para agregar token JWT a cada request
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Rutas cuyo 401 no significa "tu sesión venció".
const isAuthFormRequest = (url?: string) =>
  !!url &&
  ['/auth/login', '/auth/verify-email', '/auth/refresh'].some((path) => url.includes(path));

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Interceptor para manejar errores de respuesta
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // La validación del backend devuelve una lista de mensajes; las pantallas
    // muestran data.message tal cual y una lista sale pegada en una sola línea
    if (Array.isArray(error.response?.data?.message)) {
      error.response.data.message = error.response.data.message.join('. ');
    }

    // Un error del servidor lleva el código de la petición (X-Request-Id): el usuario lo dicta
    // a soporte y con él se encuentra en los logs y en Sentry. Las pantallas muestran
    // data.message, así que el código va dentro del mensaje.
    const requestId = error.response?.headers?.['x-request-id'];
    if (requestId) {
      error.requestId = requestId;
      if (error.response.status >= 500) {
        const data =
          typeof error.response.data === 'object' && error.response.data ? error.response.data : {};
        const message =
          typeof data.message === 'string' && data.message !== 'Internal server error'
            ? data.message
            : 'Ocurrió un error inesperado';
        error.response.data = { ...data, message: `${message} (código ${requestId})` };
      }
    }

    const config = error.config as RetriableConfig | undefined;
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      config &&
      !isAuthFormRequest(config.url)
    ) {
      // El token de acceso venció: se renueva una vez y se repite la petición.
      if (!config._retried && localStorage.getItem(SESSION_KEPT_KEY) === '1') {
        config._retried = true;
        try {
          const token = await refreshSession();
          config.headers.Authorization = `Bearer ${token}`;
          return apiClient(config);
        } catch (refreshError) {
          // Sin red no se cierra la sesión: la petición falla y se puede reintentar.
          if (!(refreshError instanceof SessionExpiredError)) {
            return Promise.reject(error);
          }
        }
      }
      goToLogin();
    }

    // Marcar errores de email no verificado para manejo en componentes
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || '';
      if (message.includes('verificar tu email')) {
        error.isEmailNotVerified = true;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
