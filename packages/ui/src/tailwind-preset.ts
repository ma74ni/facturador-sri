import type { Config } from 'tailwindcss';

/** Un rol de color MD3 de tokens.css, con soporte de opacidad (`bg-primary/10`). */
const role = (name: string) => `rgb(var(--md-${name}) / <alpha-value>)`;

const MD3_ROLES = [
  'primary',
  'on-primary',
  'primary-container',
  'on-primary-container',
  'on-secondary',
  'on-secondary-container',
  'tertiary',
  'on-tertiary',
  'tertiary-container',
  'on-tertiary-container',
  'error',
  'on-error',
  'error-container',
  'on-error-container',
  'success',
  'on-success',
  'success-container',
  'on-success-container',
  'warning',
  'on-warning',
  'warning-container',
  'on-warning-container',
  'surface',
  'on-surface',
  'surface-variant',
  'on-surface-variant',
  'surface-dim',
  'surface-bright',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'inverse-surface',
  'inverse-on-surface',
  'inverse-primary',
  'outline',
  'outline-variant',
  'scrim',
] as const;

/**
 * Nombres que ya usan las pantallas (heredados de shadcn), apuntando al rol MD3 equivalente.
 * Así toda la app toma la paleta nueva sin reescribir clases; el código nuevo usa los roles MD3.
 */
const LEGACY_ALIASES: Record<string, string> = {
  background: 'surface',
  foreground: 'on-surface',
  card: 'surface-container-lowest',
  'card-foreground': 'on-surface',
  popover: 'surface-container-low',
  'popover-foreground': 'on-surface',
  'primary-foreground': 'on-primary',
  // En shadcn "secondary" es un fondo suave: en MD3 eso es secondary-container.
  secondary: 'secondary-container',
  'secondary-foreground': 'on-secondary-container',
  'secondary-container': 'secondary-container',
  muted: 'surface-container-high',
  'muted-foreground': 'on-surface-variant',
  accent: 'surface-container-highest',
  'accent-foreground': 'on-surface',
  destructive: 'error',
  'destructive-foreground': 'on-error',
  border: 'outline-variant',
  input: 'outline',
  ring: 'primary',
};

type FontSize = [string, { lineHeight: string; letterSpacing: string; fontWeight?: string }];
const type = (size: number, lineHeight: number, tracking: number, weight?: number): FontSize => [
  `${size / 16}rem`,
  {
    lineHeight: `${lineHeight / 16}rem`,
    letterSpacing: `${tracking / 16}rem`,
    ...(weight ? { fontWeight: String(weight) } : {}),
  },
];

/** Preset de Tailwind del design system: colores, tipografía, formas y elevación de MD3. */
export const uiPreset = {
  theme: {
    extend: {
      colors: Object.fromEntries([
        ...MD3_ROLES.map((name) => [name, role(name)]),
        ...Object.entries(LEGACY_ALIASES).map(([alias, name]) => [alias, role(name)]),
      ]),
      fontFamily: {
        sans: ['var(--font-sans)', 'Roboto', 'system-ui', 'sans-serif'],
      },
      // Escala tipográfica MD3: `text-title-md`, `text-body-sm`…
      fontSize: {
        'display-lg': type(57, 64, -0.25),
        'display-md': type(45, 52, 0),
        'display-sm': type(36, 44, 0),
        'headline-lg': type(32, 40, 0),
        'headline-md': type(28, 36, 0),
        'headline-sm': type(24, 32, 0),
        'title-lg': type(22, 28, 0),
        'title-md': type(16, 24, 0.15, 500),
        'title-sm': type(14, 20, 0.1, 500),
        'body-lg': type(16, 24, 0.5),
        'body-md': type(14, 20, 0.25),
        'body-sm': type(12, 16, 0.4),
        'label-lg': type(14, 20, 0.1, 500),
        'label-md': type(12, 16, 0.5, 500),
        'label-sm': type(11, 16, 0.5, 500),
      },
      // Escala de formas MD3. `rounded-lg` (tarjetas) = 12px, `rounded-md` (campos) = 8px.
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.75rem',
      },
      // Elevación MD3 (niveles 1 a 5).
      boxShadow: {
        'elevation-1': '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 1px 3px 1px rgb(0 0 0 / 0.15)',
        'elevation-2': '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 2px 6px 2px rgb(0 0 0 / 0.15)',
        'elevation-3': '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 4px 8px 3px rgb(0 0 0 / 0.15)',
        'elevation-4': '0 2px 3px 0 rgb(0 0 0 / 0.3), 0 6px 10px 4px rgb(0 0 0 / 0.15)',
        'elevation-5': '0 4px 4px 0 rgb(0 0 0 / 0.3), 0 8px 12px 6px rgb(0 0 0 / 0.15)',
      },
    },
  },
} satisfies Partial<Config>;

export default uiPreset;
