import * as React from 'react';
import { cn } from '../lib/cn';
import { fieldStyles } from './field-styles';

/**
 * `<select>` nativo con el mismo look que `Input`. Para filtros conviene más que el Select de
 * Radix: en el celular abre el selector del sistema, más cómodo con el dedo.
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldStyles, 'h-10 py-2', className)} {...props} />
));
NativeSelect.displayName = 'NativeSelect';

export { NativeSelect };
