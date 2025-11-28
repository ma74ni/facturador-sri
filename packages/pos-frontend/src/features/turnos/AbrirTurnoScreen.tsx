import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DollarSign, Calendar, User, Store, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { turnosApi } from '@/lib/api/turnos';
import { useSessionStore } from '@/store/sessionStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';

export function AbrirTurnoScreen() {
  const navigate = useNavigate();
  const { local, colaborador, setTurnoActivo } = useSessionStore();
  const [efectivoInicial, setEfectivoInicial] = useState('');

  // Verificar si hay un turno activo
  const { data: turnoActivo, isLoading: isLoadingTurno } = useQuery({
    queryKey: ['turno-activo', local?.id],
    queryFn: () => turnosApi.getTurnoActivo(local!.id),
    enabled: !!local?.id,
  });

  // Si ya hay un turno activo, redirigir al POS
  useEffect(() => {
    if (turnoActivo) {
      setTurnoActivo(turnoActivo);
      toast.info('Ya existe un turno activo');
      navigate('/pos');
    }
  }, [turnoActivo, setTurnoActivo, navigate]);

  // Mutation para abrir turno
  const abrirTurnoMutation = useMutation({
    mutationFn: turnosApi.abrirTurno,
    onSuccess: (data) => {
      setTurnoActivo(data);
      toast.success('Turno abierto exitosamente');
      navigate('/pos');
    },
    onError: (error: any) => {
      console.error('Error abriendo turno:', error);
      toast.error(error.response?.data?.message || 'Error al abrir el turno');
    },
  });

  const handleAbrirTurno = () => {
    if (!efectivoInicial || parseFloat(efectivoInicial) < 0) {
      toast.error('Ingrese un monto válido de efectivo inicial');
      return;
    }

    if (!local || !colaborador) {
      toast.error('Datos de sesión incompletos');
      navigate('/login');
      return;
    }

    abrirTurnoMutation.mutate({
      localId: local.id,
      colaboradorId: colaborador.id,
      efectivoInicial: parseFloat(efectivoInicial),
    });
  };

  const handleLogout = () => {
    navigate('/login');
  };

  if (isLoadingTurno) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/5 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Apertura de Caja</CardTitle>
          <CardDescription>Ingrese el efectivo inicial para comenzar el turno</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Información de sesión */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center text-sm">
              <Store className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Local:</span>
              <span className="ml-2">{local?.nombre}</span>
            </div>
            <div className="flex items-center text-sm">
              <User className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Colaborador:</span>
              <span className="ml-2">
                {colaborador?.nombre} {colaborador?.apellido}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Fecha:</span>
              <span className="ml-2">{format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}</span>
            </div>
          </div>

          {/* Input de efectivo inicial */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              <DollarSign className="mb-1 mr-2 inline h-4 w-4" />
              Efectivo Inicial
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={efectivoInicial}
              onChange={(e) => setEfectivoInicial(e.target.value)}
              placeholder="0.00"
              className="text-right text-xl"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAbrirTurno();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ingrese el monto de efectivo con el que inicia la caja
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLogout} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleAbrirTurno}
              disabled={!efectivoInicial || abrirTurnoMutation.isPending}
              className="flex-1"
              size="lg"
            >
              {abrirTurnoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abriendo...
                </>
              ) : (
                'Abrir Turno'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
