import * as React from 'react';
import { cn } from '../lib/cn';
import { FieldError } from '../atoms/field-error';
import { Label } from '../atoms/label';

export interface FormFieldProps {
  label: React.ReactNode;
  /** `id` del campo, para que la etiqueta lo enfoque. */
  htmlFor?: string;
  /** Mensaje de error (`errors.x?.message` de react-hook-form o un string propio). */
  error?: React.ReactNode;
  /** Ayuda bajo el campo; se oculta mientras hay error. */
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Etiqueta + campo + ayuda o error, con el mismo espaciado en todos los formularios.
 * Si el hijo es un único elemento, le pone `aria-invalid` (borde rojo de `fieldStyles`) y
 * `aria-describedby` apuntando al mensaje.
 */
export function FormField({ label, htmlFor, error, hint, className, children }: FormFieldProps) {
  const autoId = React.useId();
  const messageId = `${htmlFor ?? autoId}-message`;
  const hasMessage = Boolean(error || hint);

  const field =
    React.isValidElement<Record<string, unknown>>(children) && error
      ? React.cloneElement(children, {
          'aria-invalid': true,
          'aria-describedby': messageId,
        })
      : React.isValidElement<Record<string, unknown>>(children) && hasMessage
        ? React.cloneElement(children, { 'aria-describedby': messageId })
        : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {field}
      {error ? (
        <FieldError id={messageId} message={error} />
      ) : (
        hint && (
          <p id={messageId} className="text-body-sm text-on-surface-variant">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
