import { useState, useMemo } from 'react';
import type { Producto, Modificador, OrderItem } from '@/lib/types';
import { useModificadores } from '@/lib/hooks/useProductos';
import { calculateItemSubtotal, formatCurrency } from '@/lib/utils/cartCalculations';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModificadoresModalProps {
  producto: Producto | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: OrderItem) => void;
}

export function ModificadoresModal({
  producto,
  open,
  onClose,
  onAddToCart,
}: ModificadoresModalProps) {
  const { data: modificadores = [] } = useModificadores();

  // State
  const [selectedSabores, setSelectedSabores] = useState<Modificador[]>([]);
  const [selectedToppings, setSelectedToppings] = useState<Modificador[]>([]);
  const [selectedAderezos, setSelectedAderezos] = useState<Modificador[]>([]);
  const [selectedSustituciones, setSelectedSustituciones] = useState<Modificador[]>([]);
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState('');

  // Filter modificadores by type
  const sabores = modificadores.filter((m) => m.tipo === 'SABOR' && m.disponible);
  const toppings = modificadores.filter((m) => m.tipo === 'TOPPING' && m.disponible);
  const aderezos = modificadores.filter((m) => m.tipo === 'ADEREZO' && m.disponible);
  const sustituciones = modificadores.filter((m) => m.tipo === 'SUSTITUCION' && m.disponible);

  // Get categoria configuration
  const categoria = producto?.categoria;

  // Calculate subtotal
  const subtotal = useMemo(() => {
    if (!producto) return 0;
    return calculateItemSubtotal(producto.precioBase, cantidad, {
      sabores: selectedSabores,
      toppings: selectedToppings,
      aderezos: selectedAderezos,
      sustituciones: selectedSustituciones,
    });
  }, [producto, cantidad, selectedSabores, selectedToppings, selectedAderezos, selectedSustituciones]);

  // Validation
  const canAddToCart = useMemo(() => {
    if (!producto || !categoria) return false;

    // Check required sabores
    if (categoria.permiteSeleccionarSabores && categoria.cantidadSaboresObligatorios) {
      if (selectedSabores.length < categoria.cantidadSaboresObligatorios) {
        return false;
      }
    }

    return true;
  }, [producto, categoria, selectedSabores]);

  // Handlers
  const toggleModificador = (
    modificador: Modificador,
    selected: Modificador[],
    setSelected: (mods: Modificador[]) => void,
    maxCount?: number
  ) => {
    const isSelected = selected.some((m) => m.id === modificador.id);

    if (isSelected) {
      // Remove if already selected
      setSelected(selected.filter((m) => m.id !== modificador.id));
    } else {
      // Add if not at max
      if (!maxCount || selected.length < maxCount) {
        setSelected([...selected, modificador]);
      }
      // If at max, do nothing (button should be disabled)
    }
  };

  const handleAddToCart = () => {
    if (!producto || !canAddToCart) return;

    // Calculate precio unitario including modificadores
    const precioUnitarioConModificadores = subtotal / cantidad;

    const item: OrderItem = {
      productoId: producto.id,
      nombreProducto: producto.nombre,
      precioUnitario: precioUnitarioConModificadores,
      cantidad,
      sabores: selectedSabores.length > 0 ? selectedSabores : undefined,
      toppings: selectedToppings.length > 0 ? selectedToppings : undefined,
      aderezos: selectedAderezos.length > 0 ? selectedAderezos : undefined,
      sustituciones: selectedSustituciones.length > 0 ? selectedSustituciones : undefined,
      subtotalItem: subtotal,
      notas: notas || undefined,
    };

    onAddToCart(item);
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    setSelectedSabores([]);
    setSelectedToppings([]);
    setSelectedAderezos([]);
    setSelectedSustituciones([]);
    setCantidad(1);
    setNotas('');
    onClose();
  };

  if (!producto || !categoria) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{producto.nombre}</DialogTitle>
          <DialogDescription>
            {producto.descripcion || 'Personaliza tu producto'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sabores */}
          {categoria.permiteSeleccionarSabores && sabores.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Sabores</Label>
                {categoria.cantidadSaboresObligatorios && (
                  <Badge variant={selectedSabores.length >= categoria.cantidadSaboresObligatorios ? 'default' : 'destructive'}>
                    {selectedSabores.length} / {categoria.cantidadSaboresObligatorios} requeridos
                    {categoria.cantidadSaboresMax && categoria.cantidadSaboresMax > categoria.cantidadSaboresObligatorios && (
                      <span className="ml-1">(máx: {categoria.cantidadSaboresMax})</span>
                    )}
                  </Badge>
                )}
                {!categoria.cantidadSaboresObligatorios && categoria.cantidadSaboresMax && (
                  <Badge variant="secondary">
                    {selectedSabores.length} / {categoria.cantidadSaboresMax} máximo
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sabores.map((sabor) => {
                  const isSelected = selectedSabores.some((s) => s.id === sabor.id);
                  const isDisabled = !isSelected && !!categoria.cantidadSaboresMax && selectedSabores.length >= categoria.cantidadSaboresMax;
                  return (
                    <Button
                      key={sabor.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        toggleModificador(
                          sabor,
                          selectedSabores,
                          setSelectedSabores,
                          categoria.cantidadSaboresMax
                        )
                      }
                      disabled={isDisabled}
                      className={cn('justify-start', isSelected && 'shadow-md')}
                    >
                      {sabor.nombre}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toppings */}
          {categoria.permiteSeleccionarToppings && toppings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Toppings</Label>
                {categoria.cantidadToppingsMax ? (
                  <Badge variant="secondary">
                    {selectedToppings.length} / {categoria.cantidadToppingsMax} máximo
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Opcionales</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {toppings.map((topping) => {
                  const isSelected = selectedToppings.some((t) => t.id === topping.id);
                  const isDisabled = !isSelected && !!categoria.cantidadToppingsMax && selectedToppings.length >= categoria.cantidadToppingsMax;
                  return (
                    <Button
                      key={topping.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        toggleModificador(
                          topping,
                          selectedToppings,
                          setSelectedToppings,
                          categoria.cantidadToppingsMax
                        )
                      }
                      disabled={isDisabled}
                      className={cn('justify-between', isSelected && 'shadow-md')}
                    >
                      <span>{topping.nombre}</span>
                      {topping.precioAdicional && topping.precioAdicional > 0 && (
                        <span className="text-xs ml-2">
                          +{formatCurrency(topping.precioAdicional)}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aderezos */}
          {categoria.permiteSeleccionarAderezos && aderezos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Aderezos</Label>
                {categoria.cantidadAderezosMax ? (
                  <Badge variant="secondary">
                    {selectedAderezos.length} / {categoria.cantidadAderezosMax} máximo
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Opcionales</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {aderezos.map((aderezo) => {
                  const isSelected = selectedAderezos.some((a) => a.id === aderezo.id);
                  const isDisabled = !isSelected && !!categoria.cantidadAderezosMax && selectedAderezos.length >= categoria.cantidadAderezosMax;
                  return (
                    <Button
                      key={aderezo.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        toggleModificador(
                          aderezo,
                          selectedAderezos,
                          setSelectedAderezos,
                          categoria.cantidadAderezosMax
                        )
                      }
                      disabled={isDisabled}
                      className={cn('justify-between', isSelected && 'shadow-md')}
                    >
                      <span>{aderezo.nombre}</span>
                      {aderezo.precioAdicional && aderezo.precioAdicional > 0 && (
                        <span className="text-xs ml-2">
                          +{formatCurrency(aderezo.precioAdicional)}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sustituciones */}
          {categoria.permiteSustituciones && sustituciones.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Sustituciones</Label>
                <span className="text-sm text-muted-foreground">Opcionales</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sustituciones.map((sustitucion) => {
                  const isSelected = selectedSustituciones.some((s) => s.id === sustitucion.id);
                  return (
                    <Button
                      key={sustitucion.id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        toggleModificador(
                          sustitucion,
                          selectedSustituciones,
                          setSelectedSustituciones
                        )
                      }
                      className={cn('justify-start text-left h-auto py-2', isSelected && 'shadow-md')}
                    >
                      {sustitucion.nombre}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <Label htmlFor="notas" className="text-base font-semibold mb-2 block">
              Notas especiales
            </Label>
            <Input
              id="notas"
              placeholder="Ej: Sin azúcar, extra caliente..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <Separator />

          {/* Cantidad y Total */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Cantidad</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  disabled={cantidad <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xl font-bold w-12 text-center">{cantidad}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCantidad(cantidad + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(subtotal)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className="flex-1"
              size="lg"
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Agregar al Carrito
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
