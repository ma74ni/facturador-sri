import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { Card } from './card';

const TONES = {
  neutral: 'text-on-surface-variant',
  primary: 'text-primary',
  tertiary: 'text-tertiary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-error',
} as const;

export type StatCardTone = keyof typeof TONES;

export interface StatCardProps {
  title: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Color del ícono. La cifra queda siempre en `on-surface` para que todas se lean igual. */
  tone?: StatCardTone;
  className?: string;
}

/** Tarjeta de indicador: título con ícono, la cifra grande y una línea de contexto. */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('flex flex-col gap-1 p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-label-lg text-on-surface-variant">{title}</span>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', TONES[tone])} aria-hidden />}
      </div>
      <div className="text-headline-sm text-on-surface sm:text-headline-md">{value}</div>
      {description && <p className="text-body-sm text-on-surface-variant">{description}</p>}
    </Card>
  );
}
