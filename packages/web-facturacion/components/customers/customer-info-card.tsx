'use client';

import { Customer } from '@/lib/api/customers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, MapPin, FileText, Edit, X } from 'lucide-react';

interface CustomerInfoCardProps {
  customer: Customer;
  onEdit?: () => void;
  onClose?: () => void;
  compact?: boolean;
}

const IDENTIFICATION_TYPES = {
  RUC: 'RUC',
  CEDULA: 'Cédula',
  PASAPORTE: 'Pasaporte',
};

export function CustomerInfoCard({ customer, onEdit, onClose, compact = false }: CustomerInfoCardProps) {
  const displayName = customer.businessName ||
    (customer.firstName && customer.lastName ? `${customer.firstName} ${customer.lastName}` :
    customer.firstName || customer.lastName || 'Sin nombre');

  const identificationLabel = IDENTIFICATION_TYPES[customer.identificationType as keyof typeof IDENTIFICATION_TYPES] || customer.identificationType;

  if (compact) {
    return (
      <div className="border border-primary/20 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary flex-shrink-0" />
              <h4 className="font-semibold text-slate-900 truncate">{displayName}</h4>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-slate-600">{identificationLabel}:</span>
                <span className="font-mono font-medium text-slate-900">{customer.identification}</span>
              </div>

              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-700 truncate">{customer.email}</span>
                </div>
              )}

              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  <span className="text-slate-700">{customer.phone}</span>
                </div>
              )}

              {customer.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-xs leading-relaxed">{customer.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-1 flex-shrink-0">
            {onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="h-8 px-2"
                title="Editar cliente"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 px-2 hover:bg-red-100 hover:text-red-600"
                title="Quitar selección"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Información del Cliente
          </CardTitle>
          {onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-500 mb-1">Nombre</p>
            <p className="text-base font-semibold text-slate-900">{displayName}</p>
          </div>

          <div>
            <p className="text-sm text-slate-500 mb-1">Identificación</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{identificationLabel}</Badge>
              <span className="font-mono font-medium text-slate-900">{customer.identification}</span>
            </div>
          </div>

          {customer.email && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Email</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <a href={`mailto:${customer.email}`} className="text-sm text-blue-600 hover:underline">
                  {customer.email}
                </a>
              </div>
            </div>
          )}

          {customer.phone && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Teléfono</p>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <a href={`tel:${customer.phone}`} className="text-sm text-slate-700">
                  {customer.phone}
                </a>
              </div>
            </div>
          )}

          {customer.address && (
            <div>
              <p className="text-sm text-slate-500 mb-1">Dirección</p>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <p className="text-sm text-slate-700 leading-relaxed">{customer.address}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
