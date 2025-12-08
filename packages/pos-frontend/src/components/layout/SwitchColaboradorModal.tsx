import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { User, Lock, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { colaboradoresApi } from '@/lib/api/colaboradores';
import { useSessionStore } from '@/store/sessionStore';
import type { Colaborador } from '@/lib/types';

interface SwitchColaboradorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SwitchColaboradorModal({ isOpen, onClose }: SwitchColaboradorModalProps) {
  const { local, colaborador: colaboradorActual, setColaborador, turnoActivo } = useSessionStore();
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>('');
  const [pin, setPin] = useState('');

  // Obtener colaboradores del local
  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ['colaboradores', local?.id],
    queryFn: () => colaboradoresApi.getByLocal(local!.id),
    enabled: !!local?.id && isOpen,
  });

  // Mutation para validar PIN y cambiar colaborador
  const switchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedColaboradorId) {
        throw new Error('Seleccione un colaborador');
      }

      const colaboradorSeleccionado = colaboradores?.find((c) => c.id === selectedColaboradorId);
      if (!colaboradorSeleccionado) {
        throw new Error('Colaborador no encontrado');
      }

      // Si el colaborador tiene PIN, validarlo
      if (colaboradorSeleccionado.pin) {
        if (!pin) {
          throw new Error('Ingrese el PIN del colaborador');
        }

        const isValid = await colaboradoresApi.validatePin(selectedColaboradorId, pin);
        if (!isValid) {
          throw new Error('PIN incorrecto');
        }
      }

      return colaboradorSeleccionado;
    },
    onSuccess: (colaboradorSeleccionado) => {
      setColaborador(colaboradorSeleccionado);
      toast.success(`Ahora atendiendo como ${colaboradorSeleccionado.nombre} ${colaboradorSeleccionado.apellido || ''}`);
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al cambiar colaborador');
      setPin('');
    },
  });

  const handleClose = () => {
    setSelectedColaboradorId('');
    setPin('');
    onClose();
  };

  const handleSwitch = () => {
    switchMutation.mutate();
  };

  // Obtener el colaborador que abrió el turno
  const colaboradorTurno = turnoActivo?.colaborador || colaboradores?.find(
    (c) => c.id === turnoActivo?.colaboradorId
  );

  const colaboradorSeleccionado = colaboradores?.find((c) => c.id === selectedColaboradorId);
  const requierePin = colaboradorSeleccionado?.pin != null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar Colaborador</DialogTitle>
          <DialogDescription>
            Selecciona el colaborador que estará atendiendo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info del turno */}
          {colaboradorTurno && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                Turno abierto por:{' '}
                <span className="font-medium text-foreground">
                  {colaboradorTurno.nombre} {colaboradorTurno.apellido || ''}
                </span>
              </p>
            </div>
          )}

          {/* Selector de colaborador */}
          <div className="space-y-2">
            <Label>Selecciona colaborador:</Label>
            <RadioGroup
              value={selectedColaboradorId}
              onValueChange={setSelectedColaboradorId}
              className="space-y-2"
            >
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : (
                colaboradores
                  ?.filter((c) => c.activo)
                  .map((colaborador) => (
                    <div
                      key={colaborador.id}
                      className={`flex items-center space-x-3 rounded-lg border p-3 ${
                        selectedColaboradorId === colaborador.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      } ${colaboradorActual?.id === colaborador.id ? 'ring-2 ring-primary/30' : ''}`}
                    >
                      <RadioGroupItem value={colaborador.id} id={colaborador.id} />
                      <label htmlFor={colaborador.id} className="flex flex-1 cursor-pointer items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ backgroundColor: colaborador.color }}
                        >
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {colaborador.nombre} {colaborador.apellido || ''}
                          </p>
                          {colaboradorActual?.id === colaborador.id && (
                            <p className="text-xs text-primary">Actual</p>
                          )}
                        </div>
                        {colaborador.pin && <Lock className="h-4 w-4 text-muted-foreground" />}
                      </label>
                    </div>
                  ))
              )}
            </RadioGroup>
          </div>

          {/* Campo PIN */}
          {selectedColaboradorId && requierePin && (
            <div className="space-y-2">
              <Label htmlFor="pin">PIN de {colaboradorSeleccionado?.nombre}:</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="text-center text-xl tracking-widest"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pin.length >= 4) {
                    handleSwitch();
                  }
                }}
              />
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1" disabled={switchMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSwitch}
              className="flex-1"
              disabled={
                !selectedColaboradorId ||
                (requierePin && pin.length < 4) ||
                switchMutation.isPending ||
                selectedColaboradorId === colaboradorActual?.id
              }
            >
              {switchMutation.isPending ? (
                'Cambiando...'
              ) : selectedColaboradorId === colaboradorActual?.id ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Ya seleccionado
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
