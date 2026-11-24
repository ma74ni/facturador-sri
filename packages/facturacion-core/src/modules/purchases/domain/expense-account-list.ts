/** Reglas del catálogo de cuentas de gasto, compartidas por los DTO y la lista pegada. */
export const EXPENSE_ACCOUNT_NAME_MAX = 120;
export const EXPENSE_ACCOUNT_CODE_MAX = 30;
/** Códigos de plan de cuentas: "5", "5.1.01", "510-02", "GA01". */
export const EXPENSE_ACCOUNT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;
/** Tope de líneas por lista pegada: un plan de cuentas de gasto tiene decenas, no miles. */
export const EXPENSE_ACCOUNT_LIST_MAX_LINES = 500;

export interface ParsedExpenseAccount {
  line: number;
  code: string | null;
  name: string;
}

export interface ExpenseAccountLineError {
  line: number;
  text: string;
  reason: string;
}

/** Espacios repetidos o tabulaciones dentro del nombre cuentan como uno. */
export const normalizeAccountName = (name: string) => name.replace(/\s+/g, ' ').trim();

/** Clave única del nombre: sin distinguir mayúsculas. */
export const accountNameKey = (name: string) => normalizeAccountName(name).toLowerCase();

export function expenseAccountCodeError(code: string): string | null {
  if (code.length > EXPENSE_ACCOUNT_CODE_MAX) {
    return `El código puede tener hasta ${EXPENSE_ACCOUNT_CODE_MAX} caracteres`;
  }
  if (!EXPENSE_ACCOUNT_CODE_PATTERN.test(code)) {
    return 'El código solo puede tener letras, números, puntos y guiones';
  }
  return null;
}

export function expenseAccountNameError(name: string): string | null {
  if (!name) return 'El nombre de la cuenta es obligatorio';
  if (name.length > EXPENSE_ACCOUNT_NAME_MAX) {
    return `El nombre puede tener hasta ${EXPENSE_ACCOUNT_NAME_MAX} caracteres`;
  }
  return null;
}

// "5.1.01 Materia prima", "5.1.01 - Materia prima", "510: Arriendo". El código empieza con un dígito.
const CODE_THEN_NAME = /^(\d[\w.-]*?)\.?\s*[-–:]?\s+(\S.*)$/;
const HEADER = /^c[oó]digo\b/i;

/**
 * Lee la lista de cuentas que pasa el contador, una por línea. Acepta lo copiado de Excel
 * (código y nombre separados por tabulación), "código;nombre", "código nombre" o solo el nombre.
 * Una primera línea de encabezados ("Código  Nombre") se ignora.
 */
export function parseExpenseAccountList(text: string): {
  accounts: ParsedExpenseAccount[];
  errors: ExpenseAccountLineError[];
} {
  const accounts: ParsedExpenseAccount[] = [];
  const errors: ExpenseAccountLineError[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed || (accounts.length === 0 && errors.length === 0 && HEADER.test(trimmed))) {
      return;
    }

    let code: string | null = null;
    let name: string;
    const separator = raw.includes('\t') ? '\t' : trimmed.includes(';') ? ';' : null;
    if (separator) {
      const parts = trimmed
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        code = parts[0];
        name = parts.slice(1).join(' ');
      } else {
        name = parts[0] ?? '';
      }
    } else {
      const match = CODE_THEN_NAME.exec(trimmed);
      if (match) {
        code = match[1];
        name = match[2];
      } else {
        name = trimmed;
      }
    }

    name = normalizeAccountName(name);
    const reason =
      (code !== null && expenseAccountCodeError(code)) || expenseAccountNameError(name);
    if (reason) {
      errors.push({ line, text: trimmed, reason });
    } else {
      accounts.push({ line, code, name });
    }
  });

  return { accounts, errors };
}
