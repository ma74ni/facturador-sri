import * as React from 'react';
import { cn } from '../lib/cn';
import { fieldStyles } from './field-styles';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        fieldStyles,
        'h-10 py-2 file:border-0 file:bg-transparent file:text-label-lg file:text-on-surface',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
