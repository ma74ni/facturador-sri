import type { Metadata } from 'next';
import localFont from 'next/font/local';
import '@facturador-sri/ui/tokens.css';
import './globals.css';
import { AuthProvider } from '@/lib/context/auth-context';
import { QueryProvider } from '@/lib/providers/query-provider';
import { Toaster } from '@/components/ui/toaster';

// Tipografía de Material 3; el preset la toma de --font-sans. Se sirve desde el repo (subconjunto
// latin de @fontsource/roboto 5.1.0, Apache 2.0): con next/font/google el build dependía de que
// Google Fonts respondiera y fallaba cuando no.
const roboto = localFont({
  src: [
    { path: './fonts/roboto/roboto-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/roboto/roboto-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/roboto/roboto-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Tu Facturador - Sistema de Facturación Electrónica',
  description: 'Sistema de facturación electrónica para Ecuador',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={roboto.variable}>
      <body className="font-sans antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
