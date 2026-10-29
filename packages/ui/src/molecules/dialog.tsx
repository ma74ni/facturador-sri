'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Diálogo Material 3.
 *
 * - Escritorio (sm+): diálogo centrado sobre `surface-container-high`, esquinas de 28px. En
 *   `size="full"` el medio (`DialogBody`) scrollea y el título y los botones quedan siempre a la vista.
 * - Móvil: pantalla completa y TODO scrollea junto, así los botones (`DialogFooter`) quedan al
 *   final del formulario: no se ve "Firmar y enviar" antes de haber llenado nada. La X queda fija.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-scrim/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * "default": diálogo chico en escritorio (sm:max-w-lg), para confirmaciones y formularios cortos.
   * "full": casi toda la pantalla también en escritorio, para formularios con varias secciones.
   *
   * Usá este prop en lugar de `max-w-*`/`max-h-*` sin prefijo en `className`: esas clases no le
   * ganan a las `sm:` de acá (tailwind-merge no las agrupa por el modificador distinto).
   */
  size?: 'default' | 'full';
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size = 'default', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex w-full flex-col gap-4 bg-surface-container-high text-on-surface duration-200',
        // Móvil: pantalla completa, todo el contenido scrollea junto (botones al final).
        'inset-0 overflow-y-auto overflow-x-hidden p-4 pt-14',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        // Escritorio: centrado, esquinas MD3 y elevación.
        'sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:p-6 sm:shadow-elevation-3',
        'sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]',
        size === 'full'
          ? // Alto FIJO en escritorio: ocupa la pantalla aunque el contenido sea corto, y solo
            // DialogBody scrollea.
            'sm:h-[94vh] sm:w-[96vw] sm:overflow-hidden'
          : 'sm:max-h-[90vh] sm:max-w-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          // En móvil queda fija sobre el contenido que scrollea: lleva fondo para no perderse.
          'fixed right-2 top-2 z-10 rounded-full bg-surface-container-high p-2 text-on-surface-variant shadow-elevation-1 sm:bg-transparent sm:shadow-none',
          'hover:bg-on-surface/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'disabled:pointer-events-none sm:absolute sm:right-4 sm:top-4',
        )}
      >
        <X className="h-5 w-5" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * El contenido "del medio" de un `DialogContent size="full"`. En escritorio crece y es lo único
 * que scrollea; en móvil fluye con el resto, para que los botones queden al final.
 */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // min-w-0: un ítem flex conserva min-width:auto y crecería con contenido que no se achica
  // (texto sin espacios, un Select largo), ensanchando todo el diálogo. overflow-x-hidden
  // explícito porque fijar overflow-y deja overflow-x en "auto".
  <div
    className={cn(
      'min-w-0 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:overflow-x-hidden',
      className,
    )}
    {...props}
  />
);
DialogBody.displayName = 'DialogBody';

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

/** Acciones del diálogo: apiladas a lo ancho en móvil (la principal arriba), en fila en escritorio. */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3 sm:pt-0',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('pr-8 text-headline-sm text-on-surface', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body-md text-on-surface-variant', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
