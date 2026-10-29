/**
 * Campo de texto "outlined" de MD3 compartido por Input, Textarea y NativeSelect: borde
 * `outline`, que se oscurece al pasar el mouse y pasa a `primary` (2px) con el foco.
 * `aria-invalid` lo pinta de `error`.
 */
export const fieldStyles = [
  'flex w-full rounded-sm border border-outline bg-transparent px-3 text-body-lg text-on-surface md:text-body-md',
  'placeholder:text-on-surface-variant/70 hover:border-on-surface',
  'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary',
  'aria-[invalid=true]:border-error aria-[invalid=true]:ring-error',
  'disabled:cursor-not-allowed disabled:opacity-[0.38] disabled:hover:border-outline',
].join(' ');
