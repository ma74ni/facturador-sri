import * as React from 'react';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { cn } from '../lib/cn';
import { IconButton } from '../atoms/icon-button';

/**
 * Menú MD3 (Radix DropdownMenu): acciones secundarias de una fila detrás de un botón "⋮", para
 * no llenar la tabla de íconos. Teclado, foco y lectores de pantalla los resuelve Radix.
 */
// No modal: las acciones suelen abrir un diálogo, y un menú modal que se cierra a la vez deja la
// página sin clics (pointer-events) hasta recargar.
const Menu = ({ modal = false, ...props }: React.ComponentProps<typeof MenuPrimitive.Root>) => (
  <MenuPrimitive.Root modal={modal} {...props} />
);
const MenuTrigger = MenuPrimitive.Trigger;
const MenuGroup = MenuPrimitive.Group;

const MenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 4, align = 'end', ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        'z-50 min-w-[12rem] overflow-hidden rounded-sm bg-surface-container text-on-surface shadow-elevation-2 py-2',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    />
  </MenuPrimitive.Portal>
));
MenuContent.displayName = MenuPrimitive.Content.displayName;

const MENU_ITEM_TONES = {
  neutral: 'text-on-surface [&_svg]:text-on-surface-variant',
  destructive: 'text-error [&_svg]:text-error',
} as const;

const MenuItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & {
    tone?: keyof typeof MENU_ITEM_TONES;
  }
>(({ className, tone = 'neutral', ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(
      'flex h-12 cursor-pointer select-none items-center gap-3 px-3 text-label-lg outline-none transition-colors',
      'focus:bg-on-surface/[0.08] data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      '[&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0',
      MENU_ITEM_TONES[tone],
      className,
    )}
    {...props}
  />
));
MenuItem.displayName = MenuPrimitive.Item.displayName;

const MenuSeparator = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator
    ref={ref}
    className={cn('my-2 h-px bg-outline-variant', className)}
    {...props}
  />
));
MenuSeparator.displayName = MenuPrimitive.Separator.displayName;

/** Botón "⋮" que abre el menú de una fila. `label` va como aria-label y tooltip. */
const MenuIconTrigger = React.forwardRef<HTMLButtonElement, { label?: string; disabled?: boolean }>(
  ({ label = 'Más acciones', disabled }, ref) => (
    <MenuPrimitive.Trigger asChild>
      <IconButton ref={ref} label={label} disabled={disabled}>
        <MoreVertical />
      </IconButton>
    </MenuPrimitive.Trigger>
  ),
);
MenuIconTrigger.displayName = 'MenuIconTrigger';

export { Menu, MenuTrigger, MenuIconTrigger, MenuContent, MenuItem, MenuGroup, MenuSeparator };
