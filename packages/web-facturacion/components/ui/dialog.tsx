"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * "default": modal chico centrado (sm:max-w-lg), para confirmaciones y
   * formularios de 1-2 campos.
   * "full": ocupa casi toda la pantalla en desktop también — para
   * formularios con varias secciones o tablas, evitando el scroll interno.
   *
   * OJO al pasar tamaños por `className` en vez de este prop: cualquier
   * `max-w-*`/`max-h-*` SIN el prefijo `sm:` no le gana al `sm:max-w-lg` de
   * acá (tailwind-merge no las considera del mismo grupo por el modificador
   * distinto, y en CSS la regla `sm:` -por quedar después en la hoja de
   * estilos- termina ganando en pantallas de escritorio). Usá este prop.
   */
  size?: "default" | "full"
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size = "default", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // flex-col (no grid): para "full" necesitamos que el medio (DialogBody)
        // pueda crecer con flex-1 y quedarse con el scroll, mientras
        // header/footer quedan siempre visibles arriba/abajo.
        "fixed z-50 flex flex-col w-full gap-4 border bg-background shadow-lg duration-200",
        // Mobile: Full screen
        "inset-0 p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        // Desktop: Centered modal
        "sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-6",
        "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
        size === "full"
          // height FIJO (no max-height): así ocupa la pantalla completa
          // siempre, aunque el contenido sea corto — no solo cuando hace
          // falta. El contenido del medio va en <DialogBody>, que es el
          // único que scrollea.
          ? "max-h-[100dvh] overflow-hidden sm:w-[96vw] sm:h-[94vh]"
          : "max-h-[100dvh] overflow-y-auto sm:max-w-lg sm:max-h-[90vh]",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-5 w-5 sm:h-4 sm:w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * Envoltorio para el contenido "del medio" en un DialogContent size="full":
 * crece para ocupar el espacio que dejan el header y el footer, y es el
 * único que scrollea — así el título y los botones de acción quedan siempre
 * visibles. No hace falta en dialogs size="default" (esos scrollean enteros).
 */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  // min-w-0: sin esto, un ítem flex conserva min-width:auto y crece para
  // hacerle lugar a cualquier contenido interno que no pueda achicarse
  // (texto sin espacios, un Select largo, etc.), empujando el ancho de todo
  // el diálogo. overflow-x-hidden explícito por la regla de CSS que, al fijar
  // overflow-y a algo distinto de "visible", computa el overflow-x en "auto"
  // (habilitando scroll horizontal) si no se lo fija a mano.
  <div className={cn("flex-1 min-w-0 overflow-y-auto overflow-x-hidden min-h-0", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

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
}
