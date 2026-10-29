/**
 * Genera src/tokens/tokens.css: la paleta Material Design 3 del facturador a partir de un color
 * semilla. Cada rol (primary, on-primary, surface-container…) queda como variable CSS con un
 * triplete RGB, para que Tailwind pueda aplicarle opacidad (`bg-primary/10`).
 *
 *   pnpm --filter @facturador-sri/ui tokens
 *
 * Cambiar la marca = cambiar SEED (y los colores extra) y volver a correr el script.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  argbFromHex,
  customColor,
  Hct,
  hexFromArgb,
  MaterialDynamicColors,
  SchemeVibrant,
} from '@material/material-color-utilities';

const SEED = '#1A5FB4';

// MD3 no trae "éxito" ni "aviso": se agregan como colores propios, armonizados con la semilla.
const EXTRA_COLORS = [
  { name: 'success', value: '#2E7D32' },
  { name: 'warning', value: '#B26A00' },
];

const ROLES = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'surfaceDim',
  'surfaceBright',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'inverseSurface',
  'inverseOnSurface',
  'inversePrimary',
  'outline',
  'outlineVariant',
  'shadow',
  'scrim',
];

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const rgb = (argb) => `${(argb >> 16) & 255} ${(argb >> 8) & 255} ${argb & 255}`;

function schemeVars(isDark) {
  // Vibrant conserva la saturación de la semilla (TonalSpot la apaga hasta casi gris).
  const scheme = new SchemeVibrant(Hct.fromInt(argbFromHex(SEED)), isDark, 0);
  const lines = ROLES.map((role) => {
    const argb = MaterialDynamicColors[role].getArgb(scheme);
    return `  --md-${kebab(role)}: ${rgb(argb)}; /* ${hexFromArgb(argb)} */`;
  });
  for (const extra of EXTRA_COLORS) {
    const group = customColor(argbFromHex(SEED), {
      name: extra.name,
      value: argbFromHex(extra.value),
      blend: true,
    });
    const tones = isDark ? group.dark : group.light;
    const n = extra.name;
    lines.push(
      `  --md-${n}: ${rgb(tones.color)}; /* ${hexFromArgb(tones.color)} */`,
      `  --md-on-${n}: ${rgb(tones.onColor)}; /* ${hexFromArgb(tones.onColor)} */`,
      `  --md-${n}-container: ${rgb(tones.colorContainer)}; /* ${hexFromArgb(tones.colorContainer)} */`,
      `  --md-on-${n}-container: ${rgb(tones.onColorContainer)}; /* ${hexFromArgb(tones.onColorContainer)} */`,
    );
  }
  return lines.join('\n');
}

const css = `/*
 * Tokens Material Design 3 del facturador. GENERADO por scripts/generate-tokens.mjs
 * (semilla ${SEED}): no editar a mano, cambiar el script y volver a correrlo.
 *
 * El tema oscuro existe pero no está activado: se aplica con la clase .dark en <html>.
 */
:root {
${schemeVars(false)}
}

.dark {
${schemeVars(true)}
}
`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tokens', 'tokens.css');
writeFileSync(out, css);
console.log(`Tokens escritos en ${out}`);
