import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../lib/cn';

export interface FieldErrorProps {
  /** Texto del error; sin texto no se pinta nada. */
  message?: React.ReactNode;
  id?: string;
  className?: string;
}

/** Mensaje de error de un campo: ícono y texto en `error`, anunciado por lectores de pantalla. */
export function FieldError({ message, id, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn('flex items-start gap-1 text-body-sm text-error', className)}
    >
      <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
