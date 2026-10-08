'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '../api/client';
import { LoginFormData, RegisterFormData } from '../validations/schemas';

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
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => void;
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

  const checkAuth = async () => {
    try {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));

        // Verificar token con el servidor
        const response = await apiClient.get('/auth/profile');
        setUser(response.data.user);
        setCompany(response.data.company);
      }
    } catch (error) {
      // Token inválido o expirado
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      setCompany(null);
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
      router.push('/dashboard');
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Error al iniciar sesión'
      );
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
      throw new Error(
        error.response?.data?.message || 'Error al registrarse'
      );
    }
  };

  const logout = () => {
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
