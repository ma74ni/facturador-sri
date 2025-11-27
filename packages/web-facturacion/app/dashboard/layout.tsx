"use client";

import { useAuth } from "@/lib/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Building2,
  Settings,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Facturas", href: "/dashboard/facturas", icon: FileText },
    { name: "Clientes", href: "/dashboard/clientes", icon: Users },
    { name: "Productos", href: "/dashboard/productos", icon: Package },
    { name: "Reportes", href: "/dashboard/reportes", icon: BarChart3 },
    { name: "Empresa", href: "/dashboard/empresa", icon: Building2 },
    { name: "Configuración", href: "/dashboard/configuracion", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
            <div className="flex items-center">
              <FileText className="h-6 w-6 text-primary" />
              <span className="ml-2 text-lg font-semibold">Tu Facturador</span>
            </div>
            {/* Close button (mobile only) */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info & Logout */}
          <div className="p-4 border-t border-slate-200">
            <div className="mb-3">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {company?.businessName}
              </p>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-slate-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center ml-4">
            <FileText className="h-5 w-5 text-primary" />
            <span className="ml-2 text-base font-semibold">Tu Facturador</span>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          {/* Email Verification Banner */}
          {user && !user.emailVerified && (
            <Alert variant="warning" className="mb-6">
              <Mail className="h-4 w-4" />
              <AlertTitle>Verifica tu correo electrónico</AlertTitle>
              <AlertDescription>
                Hemos enviado un email de verificación a{" "}
                <strong>{user.email}</strong>. Por favor revisa tu bandeja de
                entrada y sigue las instrucciones.
              </AlertDescription>
            </Alert>
          )}

          {/* Company Status Banner */}
          {company && company.status === "PENDING" && (
            <Alert variant="info" className="mb-6">
              <Clock className="h-4 w-4" />
              <AlertTitle>Cuenta en revisión</AlertTitle>
              <AlertDescription>
                Tu empresa está siendo revisada por nuestro equipo. Mientras
                tanto, puedes usar el sistema en <strong>modo TEST</strong>.
                Recibirás un email cuando tu cuenta sea aprobada.
              </AlertDescription>
            </Alert>
          )}

          {company &&
            company.status === "APPROVED" &&
            company.environment === "TEST" && (
              <Alert variant="success" className="mb-6">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Cuenta aprobada</AlertTitle>
                <AlertDescription>
                  Tu empresa ha sido aprobada. Actualmente estás en{" "}
                  <strong>modo TEST</strong>. Contacta a soporte para activar el
                  modo PRODUCCIÓN.
                </AlertDescription>
              </Alert>
            )}

          {company && company.status === "REJECTED" && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Cuenta rechazada</AlertTitle>
              <AlertDescription>
                {company.rejectionReason ||
                  "Tu solicitud ha sido rechazada. Contacta a soporte para más información."}
              </AlertDescription>
            </Alert>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
