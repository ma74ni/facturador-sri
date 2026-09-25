import * as React from 'react';
import { cn } from '@/lib/utils';

// <select> nativo con el mismo look que <Input>. Para filtros conviene más que
// el Select de Radix: en el celular abre el selector del sistema (rueda en
// iOS, lista en Android), que es más cómodo con el dedo.
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      {...props}
    />
  )
);
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
