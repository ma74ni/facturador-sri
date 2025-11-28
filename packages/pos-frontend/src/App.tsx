import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { AbrirTurnoScreen } from '@/features/turnos/AbrirTurnoScreen';
import { POSScreen } from '@/features/pos/POSScreen';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/routes/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          {/* Ruta pública - Login */}
          <Route path="/login" element={<LoginScreen />} />

          {/* Ruta protegida - Apertura de turno */}
          <Route
            path="/turno"
            element={
              <ProtectedRoute>
                <AbrirTurnoScreen />
              </ProtectedRoute>
            }
          />

          {/* Rutas protegidas con layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute requireTurno>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/pos" replace />} />
            <Route path="pos" element={<POSScreen />} />
            <Route
              path="ordenes"
              element={
                <div className="p-8">
                  <h2 className="text-2xl font-bold">Órdenes</h2>
                  <p className="text-muted-foreground">Próximamente...</p>
                </div>
              }
            />
            <Route
              path="productos"
              element={
                <div className="p-8">
                  <h2 className="text-2xl font-bold">Productos</h2>
                  <p className="text-muted-foreground">Próximamente...</p>
                </div>
              }
            />
            <Route
              path="deliveries"
              element={
                <div className="p-8">
                  <h2 className="text-2xl font-bold">Deliveries</h2>
                  <p className="text-muted-foreground">Próximamente...</p>
                </div>
              }
            />
            <Route
              path="reportes"
              element={
                <div className="p-8">
                  <h2 className="text-2xl font-bold">Reportes</h2>
                  <p className="text-muted-foreground">Próximamente...</p>
                </div>
              }
            />
            <Route
              path="configuracion"
              element={
                <div className="p-8">
                  <h2 className="text-2xl font-bold">Configuración</h2>
                  <p className="text-muted-foreground">Próximamente...</p>
                </div>
              }
            />
          </Route>

          {/* Ruta no encontrada - Redirigir a login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
