import * as React from 'react';
import { cn } from '../lib/cn';
import { Button, type ButtonProps } from './button';

const TONES = {
  neutral: 'text-on-surface-variant',
  primary: 'text-primary',
  tertiary: 'text-tertiary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-error',
} as const;

export type IconButtonProps = Omit<ButtonProps, 'variant' | 'size' | 'aria-label'> & {
  /** Qué hace el botón. Va como `aria-label` y como tooltip (`title`): el ícono solo no lo dice. */
  label: string;
  /** Color del ícono (y de su capa de hover). */
  tone?: keyof typeof TONES;
};

/**
 * Botón de solo ícono MD3 (acciones de una fila: editar, eliminar, descargar…). Círculo de 36px
 * con la capa de estado en el color del ícono. Exige `label` para que sea accesible.
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tone = 'neutral', className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="neutral"
      size="icon"
      aria-label={label}
      title={label}
      className={cn('h-9 w-9', TONES[tone], className)}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';

export { IconButton };
