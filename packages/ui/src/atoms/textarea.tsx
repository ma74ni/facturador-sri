import * as React from 'react';
import { cn } from '../lib/cn';
import { fieldStyles } from './field-styles';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldStyles, 'min-h-[80px] py-2', className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
