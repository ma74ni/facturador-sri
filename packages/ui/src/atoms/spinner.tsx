import * as React from 'react';
import { cn } from '../lib/cn';

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  /** Texto para lectores de pantalla. */
  label?: string;
}

/** Indicador de progreso circular indeterminado de MD3, en el color del texto que lo rodea. */
function Spinner({ className, label = 'Cargando', ...props }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
      className={cn('size-5 animate-spin', className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export { Spinner };
