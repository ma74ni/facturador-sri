import type { Config } from "tailwindcss"
import { uiPreset } from "@facturador-sri/ui/tailwind-preset"

const config = {
  // Colores, tipografía, formas y elevación de Material 3 vienen del design system.
  presets: [uiPreset],
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../ui/src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    // container no se usa en ningún componente hoy (se dejó tal cual, no rompe nada).
    //
    // Convención de grillas: siempre mobile-first — `grid-cols-1 md:grid-cols-N`
    // (o directamente sin `grid-cols-1`, que ya es el default de Tailwind). Nunca
    // un `grid-cols-N≥2` suelto sin `md:`/`sm:` antes: fuerza esa cantidad de
    // columnas incluso a 320px y rompe el layout.
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
