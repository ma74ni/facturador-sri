'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  allowDecimals?: boolean;
  min?: number;
  max?: number;
  decimalPlaces?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, allowDecimals = false, min, max, decimalPlaces = 2, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string>(value.toString());

    // Sincronizar el valor interno cuando cambia el valor externo
    React.useEffect(() => {
      setInternalValue(value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;

      // Permitir valor vacío temporalmente
      if (newValue === '') {
        setInternalValue('');
        onChange(0);
        return;
      }

      // Patrón de validación según si permite decimales o no
      const pattern = allowDecimals
        ? /^-?\d*\.?\d*$/  // Permite decimales
        : /^-?\d*$/;        // Solo enteros

      // Validar que coincida con el patrón
      if (!pattern.test(newValue)) {
        return; // No actualizar si no es válido
      }

      // Si permite decimales, validar cantidad de decimales
      if (allowDecimals && newValue.includes('.')) {
        const [, decimals] = newValue.split('.');
        if (decimals && decimals.length > decimalPlaces) {
          return; // No permitir más decimales de los configurados
        }
      }

      // Actualizar el valor interno
      setInternalValue(newValue);

      // Parsear y validar el número
      const numValue = parseFloat(newValue);

      if (!isNaN(numValue)) {
        // Aplicar límites si están definidos
        let finalValue = numValue;
        if (min !== undefined && numValue < min) {
          finalValue = min;
        }
        if (max !== undefined && numValue > max) {
          finalValue = max;
        }

        onChange(finalValue);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Al perder el foco, formatear el número correctamente
      if (internalValue === '' || internalValue === '-') {
        setInternalValue('0');
        onChange(0);
      } else {
        const numValue = parseFloat(internalValue);
        if (!isNaN(numValue)) {
          let finalValue = numValue;

          // Aplicar límites
          if (min !== undefined && numValue < min) {
            finalValue = min;
          }
          if (max !== undefined && numValue > max) {
            finalValue = max;
          }

          // Formatear según si permite decimales
          const formatted = allowDecimals
            ? finalValue.toFixed(decimalPlaces)
            : finalValue.toString();

          setInternalValue(formatted);
          onChange(finalValue);
        }
      }

      // Llamar al onBlur original si existe
      if (props.onBlur) {
        props.onBlur(e);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Permitir: backspace, delete, tab, escape, enter
      if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
        // Permitir: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        // Permitir: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
        return;
      }

      // Llamar al onKeyDown original si existe
      if (props.onKeyDown) {
        props.onKeyDown(e);
      }
    };

    return (
      <input
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';

export { NumberInput };
