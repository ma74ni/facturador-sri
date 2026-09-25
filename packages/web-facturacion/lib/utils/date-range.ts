// Filtros por período sobre fechas 'YYYY-MM-DD' (o ISO completas). Se compara
// como string: 'YYYY-MM-DD' ordena igual alfabéticamente que cronológicamente.

export type PeriodPreset = 'all' | 'today' | '7d' | 'month' | 'lastMonth' | 'year' | 'custom';

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'lastMonth', label: 'Mes anterior' },
  { value: 'year', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
];

export interface DateRange {
  from?: string;
  to?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Fecha local (no UTC): "hoy" es el día del usuario, no el de Greenwich
export const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function getPeriodRange(preset: PeriodPreset, custom: DateRange = {}): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'today':
      return { from: toYMD(now), to: toYMD(now) };
    case '7d':
      return { from: toYMD(new Date(y, m, now.getDate() - 6)), to: toYMD(now) };
    case 'month':
      return { from: toYMD(new Date(y, m, 1)), to: toYMD(new Date(y, m + 1, 0)) };
    case 'lastMonth':
      return { from: toYMD(new Date(y, m - 1, 1)), to: toYMD(new Date(y, m, 0)) };
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'custom':
      return { from: custom.from || undefined, to: custom.to || undefined };
    default:
      return {};
  }
}

export function isInRange(date: string, range: DateRange): boolean {
  const d = date.slice(0, 10);
  return (!range.from || d >= range.from) && (!range.to || d <= range.to);
}
