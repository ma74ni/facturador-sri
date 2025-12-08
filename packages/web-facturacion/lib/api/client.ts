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
    if (error.response?.status === 401) {
      // No cerrar sesión si es un error de verificación de email
      const isVerifyEmailRequest =
        error.config?.url?.includes("/auth/verify-email");

      if (!isVerifyEmailRequest && typeof window !== "undefined") {
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
