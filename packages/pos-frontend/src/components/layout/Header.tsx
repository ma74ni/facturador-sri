import { useState } from 'react';
import { Store, User, Clock, DollarSign, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSessionStore } from '@/store/sessionStore';
import { CerrarTurnoScreen } from '@/features/turnos/CerrarTurnoScreen';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';

export function Header() {
  const { local, colaborador, turnoActivo } = useSessionStore();
  const [showCerrarTurno, setShowCerrarTurno] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Logo y Local */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Store className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold">POS Sistema</h1>
                <p className="text-xs text-muted-foreground">{local?.nombre}</p>
              </div>
            </div>

            {/* Info del turno */}
            {turnoActivo && (
              <div className="hidden md:flex items-center gap-3 border-l pl-4 ml-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Turno #{turnoActivo.numeroTurno || turnoActivo.numeroSecuencial}</p>
                    <p className="text-xs text-muted-foreground">
                      {turnoActivo.aperturaAt || turnoActivo.horaApertura
                        ? format(new Date(turnoActivo.aperturaAt || turnoActivo.horaApertura), 'HH:mm', { locale: es })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">${Number(turnoActivo.totalVentas || 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {turnoActivo.numeroVentas || 0} venta{(turnoActivo.numeroVentas || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Usuario y acciones */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">
                  {colaborador?.nombre} {colaborador?.apellido || ''}
                </p>
              </div>
            </div>

            {turnoActivo && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Turno Activo
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCerrarTurno(true)}
              className="hidden md:flex"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Turno
            </Button>
          </div>
        </div>
      </header>

      <CerrarTurnoScreen isOpen={showCerrarTurno} onClose={() => setShowCerrarTurno(false)} />
    </>
  );
}
