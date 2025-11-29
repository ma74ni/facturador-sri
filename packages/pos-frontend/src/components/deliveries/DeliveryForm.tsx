import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export interface DeliveryFormData {
  clienteNombre: string;
  clienteTelefono: string;
  direccion: string;
  referencia?: string;
  tiempoEstimado?: number;
}

interface DeliveryFormProps {
  data: DeliveryFormData;
  onChange: (data: DeliveryFormData) => void;
}

export function DeliveryForm({ data, onChange }: DeliveryFormProps) {
  const handleChange = (field: keyof DeliveryFormData, value: string | number) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">Datos de Entrega</h3>
      <div className="space-y-3">
        <div>
          <Label htmlFor="clienteNombre">
            Nombre del Cliente <span className="text-red-500">*</span>
          </Label>
          <Input
            id="clienteNombre"
            placeholder="Nombre completo"
            value={data.clienteNombre}
            onChange={(e) => handleChange('clienteNombre', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="clienteTelefono">
            Teléfono <span className="text-red-500">*</span>
          </Label>
          <Input
            id="clienteTelefono"
            type="tel"
            placeholder="0999999999"
            value={data.clienteTelefono}
            onChange={(e) => handleChange('clienteTelefono', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="direccion">
            Dirección <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="direccion"
            placeholder="Dirección de entrega"
            value={data.direccion}
            onChange={(e) => handleChange('direccion', e.target.value)}
            rows={2}
            required
          />
        </div>

        <div>
          <Label htmlFor="referencia">Referencia (opcional)</Label>
          <Input
            id="referencia"
            placeholder="Ej: Casa color azul, junto al parque"
            value={data.referencia || ''}
            onChange={(e) => handleChange('referencia', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="tiempoEstimado">Tiempo Estimado (minutos)</Label>
          <Input
            id="tiempoEstimado"
            type="number"
            placeholder="30"
            value={data.tiempoEstimado || ''}
            onChange={(e) => handleChange('tiempoEstimado', parseInt(e.target.value) || 0)}
            min="1"
          />
        </div>
      </div>
    </Card>
  );
}

export function validateDeliveryForm(data: DeliveryFormData): string | null {
  if (!data.clienteNombre.trim()) {
    return 'El nombre del cliente es requerido';
  }

  if (!data.clienteTelefono.trim()) {
    return 'El teléfono es requerido';
  }

  if (!data.direccion.trim()) {
    return 'La dirección es requerida';
  }

  return null;
}
