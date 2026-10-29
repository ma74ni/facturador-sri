import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "@facturador-sri/ui/tokens.css";
import "./globals.css";
import { AuthProvider } from "@/lib/context/auth-context";
import { QueryProvider } from "@/lib/providers/query-provider";
import { Toaster } from "@/components/ui/toaster";

// Tipografía de Material 3; el preset la toma de --font-sans.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Tu Facturador - Sistema de Facturación Electrónica",
  description: "Sistema de facturación electrónica para Ecuador",
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
