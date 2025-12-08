import * as React from "react"
import { Input } from "./input"
import { cn } from "@/lib/utils"

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number | string;
  onChange: (value: number) => void;
  allowNegative?: boolean;
  maxDecimals?: number;
  prefix?: string;
}

/**
 * CurrencyInput Component
 *
 * Componente de input para valores monetarios que:
 * - Solo permite números y punto decimal
 * - Formatea automáticamente con 2 decimales
 * - Previene entrada de valores inválidos
 * - Sigue principios SOLID (Single Responsibility)
 *
 * @example
 * <CurrencyInput
 *   value={amount}
 *   onChange={setAmount}
 *   placeholder="0.00"
 * />
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({
    className,
    value,
    onChange,
    allowNegative = false,
    maxDecimals = 2,
    prefix = '$',
    disabled,
    ...props
  }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>('');
    const [isFocused, setIsFocused] = React.useState(false);

    // Sincronizar el valor externo con el display value
    React.useEffect(() => {
      if (!isFocused) {
        const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
        setDisplayValue(formatCurrency(numValue, maxDecimals));
      }
    }, [value, isFocused, maxDecimals]);

    /**
     * Formatea un número como moneda
     * Responsabilidad única: formateo de valores
     */
    const formatCurrency = (num: number, decimals: number = maxDecimals): string => {
      if (isNaN(num)) return '';
      return num.toFixed(decimals);
    };

    /**
     * Sanitiza el input removiendo caracteres no permitidos
     * Responsabilidad única: validación de entrada
     */
    const sanitizeInput = (input: string): string => {
      // Remover todo excepto números, punto decimal y signo negativo (si está permitido)
      let sanitized = input.replace(/[^\d.-]/g, '');

      // Si no permite negativos, remover signo negativo
      if (!allowNegative) {
        sanitized = sanitized.replace(/-/g, '');
      }

      // Asegurar solo un punto decimal
      const parts = sanitized.split('.');
      if (parts.length > 2) {
        sanitized = parts[0] + '.' + parts.slice(1).join('');
      }

      // Limitar decimales durante la escritura
      if (parts.length === 2 && parts[1].length > maxDecimals) {
        sanitized = parts[0] + '.' + parts[1].substring(0, maxDecimals);
      }

      return sanitized;
    };

    /**
     * Valida si el string puede ser parseado a número válido
     * Responsabilidad única: validación de valor final
     */
    const isValidNumber = (str: string): boolean => {
      if (str === '' || str === '-' || str === '.') return false;
      const num = parseFloat(str);
      return !isNaN(num) && isFinite(num);
    };

    /**
     * Maneja el cambio de valor
     * Responsabilidad única: coordinación de cambio de estado
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const sanitized = sanitizeInput(rawValue);

      // Actualizar display value inmediatamente para feedback del usuario
      setDisplayValue(sanitized);

      // Notificar cambio solo si es un número válido
      if (isValidNumber(sanitized)) {
        const numericValue = parseFloat(sanitized);
        onChange(numericValue);
      } else if (sanitized === '') {
        // Si está vacío, notificar 0
        onChange(0);
      }
    };

    /**
     * Maneja el evento de focus
     * Responsabilidad única: gestión de estado de foco
     */
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Seleccionar todo el texto para facilitar sobrescribir
      e.target.select();

      // Mantener el valor numérico sin formateo para edición
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      if (numValue === 0) {
        setDisplayValue('');
      } else {
        setDisplayValue(numValue.toString());
      }
    };

    /**
     * Maneja el evento de blur
     * Responsabilidad única: finalización de edición
     */
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);

      // Parsear y formatear el valor final
      const numValue = parseFloat(displayValue) || 0;
      setDisplayValue(formatCurrency(numValue, maxDecimals));

      // Asegurar que el valor final esté sincronizado
      onChange(numValue);
    };

    /**
     * Maneja teclas especiales
     * Responsabilidad única: gestión de eventos de teclado
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Permitir: backspace, delete, tab, escape, enter
      if ([8, 9, 27, 13, 46].includes(e.keyCode)) {
        return;
      }

      // Permitir: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      if ((e.ctrlKey || e.metaKey) && [65, 67, 86, 88].includes(e.keyCode)) {
        return;
      }

      // Permitir: home, end, left, right
      if (e.keyCode >= 35 && e.keyCode <= 39) {
        return;
      }

      // Bloquear cualquier otra cosa que no sea número o punto decimal
      if ((e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
          (e.keyCode < 96 || e.keyCode > 105) &&
          e.keyCode !== 190 && e.keyCode !== 110) {
        e.preventDefault();
      }
    };

    return (
      <div className="relative">
        {prefix && !isFocused && displayValue && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            prefix && !isFocused && displayValue && "pl-7",
            "font-mono tabular-nums",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }
