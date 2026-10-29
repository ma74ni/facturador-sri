import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Aviso dentro de la página (no modal). El color viene del contenedor del rol: info (primary),
 * success, warning y destructive (error). "default" es un aviso neutro con borde.
 * Un ícono como primer hijo queda a la izquierda, alineado con el título.
 */
const alertVariants = cva(
  [
    'relative w-full rounded-lg border p-4 text-body-md',
    '[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-5 [&>svg]:w-5 [&>svg~*]:pl-8',
  ],
  {
    variants: {
      variant: {
        default:
          'border-outline-variant bg-surface-container-low text-on-surface [&>svg]:text-on-surface-variant',
        info: 'border-primary/30 bg-primary-container text-on-primary-container [&>svg]:text-primary',
        success:
          'border-success/30 bg-success-container text-on-success-container [&>svg]:text-success',
        warning:
          'border-warning/40 bg-warning-container text-on-warning-container [&>svg]:text-warning',
        destructive:
          'border-error/30 bg-error-container text-on-error-container [&>svg]:text-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  ),
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 text-title-sm', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-body-md [&_p]:leading-relaxed', className)} {...props} />
  ),
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
