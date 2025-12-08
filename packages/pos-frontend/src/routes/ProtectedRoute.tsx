import { Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTurno?: boolean;
}

export function ProtectedRoute({ children, requireTurno = false }: ProtectedRouteProps) {
  const { local, colaborador, turnoActivo } = useSessionStore();

  // Si no hay local ni colaborador, redirigir a login
  if (!local || !colaborador) {
    return <Navigate to="/login" replace />;
  }

  // Si requiere turno activo y no hay uno, redirigir a abrir turno
  if (requireTurno && !turnoActivo) {
    return <Navigate to="/turno" replace />;
  }

  return <>{children}</>;
}
