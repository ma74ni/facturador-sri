import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  CreditCard,
  Banknote,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { turnosApi } from '@/lib/api/turnos';
import { useSessionStore } from '@/store/sessionStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface CerrarTurnoScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CerrarTurnoScreen({ isOpen, onClose }: CerrarTurnoScreenProps) {
  const navigate = useNavigate();
  const { turnoActivo, clearSession } = useSessionStore();
  const [efectivoFinal, setEfectivoFinal] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Helper para convertir Decimal de Prisma a número
  const toNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    return parseFloat(value?.toString() || '0');
  };

  // Mutation para cerrar turno
  const cerrarTurnoMutation = useMutation({
    mutationFn: (data: { efectivoReal: number; notas?: string }) =>
      turnosApi.cerrarTurno(turnoActivo!.id, data),
    onSuccess: () => {
      toast.success('Turno cerrado exitosamente');
      clearSession();
      navigate('/login');
    },
    onError: (error: any) => {
      console.error('Error cerrando turno:', error);
      toast.error(error.response?.data?.message || 'Error al cerrar el turno');
    },
  });

  const handleCerrarTurno = () => {
    if (!efectivoFinal || parseFloat(efectivoFinal) < 0) {
      toast.error('Ingrese un monto válido de efectivo final');
      return;
    }

    cerrarTurnoMutation.mutate({
      efectivoReal: parseFloat(efectivoFinal),
      notas: observaciones || undefined,
    });
  };

  if (!turnoActivo) {
    return null;
  }

  // Calcular esperado vs contado
  const efectivoEsperado = toNumber(turnoActivo.efectivoInicial) + toNumber(turnoActivo.totalEfectivo);
  const efectivoContado = parseFloat(efectivoFinal || '0');
  const diferencia = efectivoContado - efectivoEsperado;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Cierre de Caja</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del turno */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Información del Turno</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Turno #:</span>
                <span className="font-medium">{turnoActivo.numeroSecuencial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Apertura:</span>
                <span className="font-medium">
                  {turnoActivo.horaApertura
                    ? format(new Date(turnoActivo.horaApertura), "dd/MM/yyyy HH:mm", { locale: es })
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efectivo Inicial:</span>
                <span className="font-medium">${toNumber(turnoActivo.efectivoInicial).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Resumen de ventas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center">
                <TrendingUp className="mr-2 h-4 w-4" />
                Resumen de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center">
                  <Banknote className="mr-2 h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Efectivo</span>
                </div>
                <span className="text-lg font-bold">${toNumber(turnoActivo.totalEfectivo).toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center">
                  <CreditCard className="mr-2 h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium">Tarjeta</span>
                </div>
                <span className="text-lg font-bold">${toNumber(turnoActivo.totalTarjeta).toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium">Transferencia</span>
                </div>
                <span className="text-lg font-bold">
                  ${toNumber(turnoActivo.totalTransferencia).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3">
                <span className="font-semibold">Total Ventas</span>
                <span className="text-xl font-bold text-primary">
                  ${toNumber(turnoActivo.totalVentas).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Número de ventas</span>
                <span className="font-medium">{turnoActivo.numeroVentas}</span>
              </div>
            </CardContent>
          </Card>

          {/* Cuadre de caja */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cuadre de Caja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  <Banknote className="mb-1 mr-2 inline h-4 w-4" />
                  Efectivo Contado
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={efectivoFinal}
                  onChange={(e) => setEfectivoFinal(e.target.value)}
                  placeholder="0.00"
                  className="text-right text-xl"
                />
              </div>

              {efectivoFinal && (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Efectivo Esperado:</span>
                    <span className="font-medium">${efectivoEsperado.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Efectivo Contado:</span>
                    <span className="font-medium">${efectivoContado.toFixed(2)}</span>
                  </div>
                  <div
                    className={`flex justify-between border-t pt-2 ${
                      diferencia === 0
                        ? 'text-green-600'
                        : diferencia > 0
                          ? 'text-blue-600'
                          : 'text-red-600'
                    }`}
                  >
                    <span className="font-semibold">Diferencia:</span>
                    <span className="text-lg font-bold">
                      {diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)}
                    </span>
                  </div>
                  {diferencia !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      {diferencia > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  <FileText className="mb-1 mr-2 inline h-4 w-4" />
                  Observaciones (opcional)
                </label>
                <Input
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales sobre el cierre..."
                  maxLength={200}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botones */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={cerrarTurnoMutation.isPending}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button
              onClick={handleCerrarTurno}
              disabled={!efectivoFinal || cerrarTurnoMutation.isPending}
              className="flex-1"
              variant={diferencia < 0 ? 'destructive' : 'default'}
            >
              {cerrarTurnoMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cerrando...
                </>
              ) : (
                'Cerrar Turno'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
