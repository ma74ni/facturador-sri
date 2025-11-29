import { useState } from 'react';
import { useSearchCustomer, useCreateCustomer } from '@/lib/hooks/useFacturacion';
import type { CustomerSearchResult } from '@/lib/api/facturacion';
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
import { Loader2, Search, UserPlus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface FacturaDialogProps {
  open: boolean;
  onClose: () => void;
  onCustomerSelected: (customer: CustomerSearchResult) => void;
}

export function FacturaDialog({
  open,
  onClose,
  onCustomerSelected,
}: FacturaDialogProps) {
  const [identificacion, setIdentificacion] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state for creating customer
  const [formData, setFormData] = useState({
    razonSocial: '',
    email: '',
    telefono: '',
    direccion: '',
  });

  const { data: customer, isLoading: searching, refetch } = useSearchCustomer(
    identificacion,
    searchTriggered
  );

  const createCustomer = useCreateCustomer();

  // Auto-detect tipo de identificacion
  const getTipoIdentificacion = (id: string): string => {
    if (id.length === 13) return 'RUC';
    if (id.length === 10) return 'CEDULA';
    return 'PASAPORTE';
  };

  const handleSearch = async () => {
    if (identificacion.length < 10) {
      toast.error('La identificación debe tener al menos 10 dígitos');
      return;
    }
    setSearchTriggered(true);
    setShowCreateForm(false);
    await refetch();
  };

  const handleCreateCustomer = async () => {
    if (!formData.razonSocial || !identificacion) {
      toast.error('Razón Social e identificación son obligatorios');
      return;
    }

    try {
      const newCustomer = await createCustomer.mutateAsync({
        identificacion,
        tipoIdentificacion: getTipoIdentificacion(identificacion),
        ...formData,
      });
      onCustomerSelected(newCustomer);
      handleClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSelectCustomer = () => {
    if (customer) {
      onCustomerSelected(customer);
      handleClose();
    }
  };

  const handleClose = () => {
    setIdentificacion('');
    setSearchTriggered(false);
    setShowCreateForm(false);
    setFormData({ razonSocial: '', email: '', telefono: '', direccion: '' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Datos de Facturación</DialogTitle>
          <DialogDescription>
            Busca o crea un cliente para emitir la factura
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Section */}
          <div>
            <Label htmlFor="identificacion">Cédula / RUC</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="identificacion"
                placeholder="1234567890"
                value={identificacion}
                onChange={(e) => {
                  setIdentificacion(e.target.value);
                  setSearchTriggered(false);
                  setShowCreateForm(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <Button
                onClick={handleSearch}
                disabled={searching || identificacion.length < 10}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Customer Found */}
          {searchTriggered && customer && !showCreateForm && (
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Cliente encontrado
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Razón Social:</strong> {customer.razonSocial}
                </p>
                <p>
                  <strong>Tipo:</strong> {customer.tipoIdentificacion}
                </p>
                {customer.email && (
                  <p>
                    <strong>Email:</strong> {customer.email}
                  </p>
                )}
                {customer.telefono && (
                  <p>
                    <strong>Teléfono:</strong> {customer.telefono}
                  </p>
                )}
              </div>
              <Button onClick={handleSelectCustomer} className="w-full mt-2">
                Confirmar Cliente
              </Button>
            </div>
          )}

          {/* Customer Not Found */}
          {searchTriggered && !customer && !searching && !showCreateForm && (
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950 space-y-2">
              <p className="text-yellow-700 dark:text-yellow-300 font-semibold">
                Cliente no encontrado
              </p>
              <Button
                onClick={() => setShowCreateForm(true)}
                variant="outline"
                className="w-full"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Crear Cliente Nuevo
              </Button>
            </div>
          )}

          {/* Create Customer Form */}
          {showCreateForm && (
            <div className="space-y-3 p-4 border rounded-lg">
              <h3 className="font-semibold">Crear Nuevo Cliente</h3>

              <div>
                <Label htmlFor="razonSocial">
                  Razón Social / Nombre Completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="razonSocial"
                  value={formData.razonSocial}
                  onChange={(e) =>
                    setFormData({ ...formData, razonSocial: e.target.value })
                  }
                  placeholder="Juan Pérez o Empresa S.A."
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="juan@example.com"
                />
              </div>

              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData({ ...formData, telefono: e.target.value })
                  }
                  placeholder="0999999999"
                />
              </div>

              <div>
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) =>
                    setFormData({ ...formData, direccion: e.target.value })
                  }
                  placeholder="Av. Principal 123"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateCustomer}
                  disabled={createCustomer.isPending}
                  className="flex-1"
                >
                  {createCustomer.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Crear y Confirmar
                </Button>
              </div>
            </div>
          )}

          {/* Info Message */}
          {!searchTriggered && (
            <p className="text-sm text-muted-foreground text-center">
              La factura será enviada al SRI al finalizar el turno
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
