import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Botón Material 3. La capa de estado (hover 8 %, pulsado/foco 12 %) se pinta con `before:`
 * en el color del contenido, debajo del texto (`isolate` + `-z-10`).
 */
const buttonVariants = cva(
  [
    'relative isolate inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-label-lg',
    'transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-current before:opacity-0 before:transition-opacity',
    'hover:before:opacity-[0.08] active:before:opacity-[0.12] focus-visible:before:opacity-[0.12]',
    'disabled:pointer-events-none disabled:opacity-[0.38] [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        filled: 'bg-primary text-on-primary hover:shadow-elevation-1',
        tonal: 'bg-secondary-container text-on-secondary-container hover:shadow-elevation-1',
        outlined: 'border border-outline text-primary',
        text: 'text-primary',
        elevated:
          'bg-surface-container-low text-primary shadow-elevation-1 hover:shadow-elevation-2',
        /** Acción neutra (íconos de una tabla, cerrar…). */
        neutral: 'text-on-surface-variant',
        destructive: 'bg-error text-on-error hover:shadow-elevation-1',
        link: 'h-auto px-0 text-primary underline-offset-4 before:hidden hover:underline',
        // Nombres heredados de shadcn, que siguen usando las pantallas.
        default: 'bg-primary text-on-primary hover:shadow-elevation-1',
        secondary: 'bg-secondary-container text-on-secondary-container hover:shadow-elevation-1',
        outline: 'border border-outline text-primary',
        ghost: 'text-on-surface-variant',
      },
      size: {
        default: 'h-10 px-6',
        sm: 'h-9 px-4',
        lg: 'h-12 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'filled',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza el hijo (p. ej. un `<Link>`) con el estilo del botón. */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
