'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient, {
  endSession,
  refreshSession,
  SESSION_KEPT_KEY,
  SessionExpiredError,
} from '../api/client';

/** Si la API no responde al abrir la app, se reintenta así (con espera creciente). */
const MAX_CHECK_AUTH_RETRIES = 4;
const CHECK_AUTH_RETRY_MS = 5000;
import { LoginFormData, RegisterFormData } from '../validations/schemas';
import type { TaxRegime, VatFilingPeriod } from '../api/company';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  emailVerified?: boolean;
  /** Administra la plataforma (aprueba empresas). Lo trae /auth/profile. */
  isPlatformAdmin?: boolean;
}

interface Company {
  id: string;
  ruc: string;
  businessName: string;
  tradeName?: string;
  email: string;
  phone?: string;
  address?: string;
  environment: 'TEST' | 'PRODUCTION';
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  enabledModules?: string[];
  // Perfil tributario (ver lib/api/company.ts).
  taxRegime?: TaxRegime;
  keepsAccounting?: boolean;
  vatFilingPeriod?: VatFilingPeriod;
  withholdingAgentResolution?: string | null;
  specialTaxpayerResolution?: string | null;
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user && !!token;

  // Reintentos de checkAuth cuando la API no responde (por ejemplo, mientras Render despierta).
  const retries = useRef(0);

  /**
   * Restaura la sesión guardada y la valida con la API. Solo la cierra si la API dice que ya
   * no vale (401 o renovación rechazada): un corte de red o un servidor despertando no saca a
   * nadie del sistema, se reintenta.
   */
  const checkAuth = async () => {
    try {
      let savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (savedUser) setUser(JSON.parse(savedUser));

      // Sin token de acceso pero con "mantener la sesión iniciada": se renueva con la cookie.
      if (!savedToken && localStorage.getItem(SESSION_KEPT_KEY) === '1') {
        savedToken = await refreshSession();
      }

      if (savedToken) {
        setToken(savedToken);
        // Verificar token con el servidor (si venció, el cliente lo renueva y reintenta)
        const response = await apiClient.get('/auth/profile');
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setToken(localStorage.getItem('token'));
        setUser(response.data.user);
        setCompany(response.data.company);
      }
      retries.current = 0;
    } catch (error) {
      const sessionGone =
        error instanceof SessionExpiredError ||
        (error as { response?: { status?: number } })?.response?.status === 401;
      if (sessionGone) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem(SESSION_KEPT_KEY);
        setUser(null);
        setToken(null);
        setCompany(null);
      } else if (retries.current < MAX_CHECK_AUTH_RETRIES) {
        // La sesión guardada sigue; se vuelve a validar en un momento.
        retries.current += 1;
        setTimeout(checkAuth, CHECK_AUTH_RETRY_MS * retries.current);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar autenticación al cargar - solo una vez
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Abre la sesión con el token recién emitido. El usuario se toma del perfil
   * (`/auth/profile`) y no de la respuesta de login/registro, que no trae
   * `companyId`: sin él las consultas de facturas, clientes y productos
   * quedaban deshabilitadas hasta recargar la página.
   */
  const startSession = async (accessToken: string) => {
    localStorage.setItem('token', accessToken);
    try {
      const { data: profile } = await apiClient.get('/auth/profile');
      localStorage.setItem('user', JSON.stringify(profile.user));
      setToken(accessToken);
      setUser(profile.user);
      setCompany(profile.company);
    } catch (error) {
      localStorage.removeItem('token');
      throw error;
    }
  };

  const login = async (data: LoginFormData) => {
    try {
      const response = await apiClient.post('/auth/login', data);
      await startSession(response.data.access_token);
      // Sin la casilla no queda marca: nunca se renueva con una cookie que no es de esta sesión.
      if (data.keepSession) localStorage.setItem(SESSION_KEPT_KEY, '1');
      else localStorage.removeItem(SESSION_KEPT_KEY);
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error al iniciar sesión');
    }
  };

  const register = async (data: RegisterFormData) => {
    try {
      const payload = {
        // Datos de empresa
        ruc: data.ruc,
        businessName: data.businessName,
        tradeName: data.tradeName,
        address: data.address,
        phone: data.phone,
        email: data.email,

        // Datos de usuario
        firstName: data.firstName,
        lastName: data.lastName,
        userEmail: data.userEmail,
        password: data.password,
      };

      const response = await apiClient.post('/auth/register', payload);

      try {
        await startSession(response.data.access_token);
      } catch (profileError) {
        // La cuenta ya existe: si no se pudo abrir la sesión, que inicie
        // sesión normalmente en vez de mostrar un error de registro.
        console.error('Error al abrir la sesión tras el registro:', profileError);
        router.push('/login');
        return;
      }

      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Error al registrarse');
    }
  };

  const logout = async () => {
    // Revoca la sesión en la API (la cookie de renovación) antes de olvidar la local.
    await endSession();
    setUser(null);
    setToken(null);
    setCompany(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        token,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
