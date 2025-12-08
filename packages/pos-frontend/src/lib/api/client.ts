import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3003/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token and turnoId
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Agregar turnoId desde sessionStore si existe
    const sessionData = localStorage.getItem('pos-session-storage');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        const turnoId = session?.state?.turnoActivo?.id;
        if (turnoId) {
          config.headers['X-Turno-Id'] = turnoId;
        }
      } catch (error) {
        console.warn('Error parsing session data:', error);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear token and redirect to login
      localStorage.removeItem('pos_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
