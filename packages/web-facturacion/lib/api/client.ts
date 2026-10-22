import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para agregar token JWT a cada request
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // La validación del backend devuelve una lista de mensajes; las pantallas
    // muestran data.message tal cual y una lista sale pegada en una sola línea
    if (Array.isArray(error.response?.data?.message)) {
      error.response.data.message = error.response.data.message.join('. ');
    }

    if (error.response?.status === 401) {
      // No cerrar sesión si es un error de verificación de email o login
      const isVerifyEmailRequest =
        error.config?.url?.includes("/auth/verify-email");
      const isLoginRequest = error.config?.url?.includes("/auth/login");

      if (!isVerifyEmailRequest && !isLoginRequest && typeof window !== "undefined") {
        // Token inválido o expirado en otras rutas
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }

    // Marcar errores de email no verificado para manejo en componentes
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || "";
      if (message.includes("verificar tu email")) {
        error.isEmailNotVerified = true;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
