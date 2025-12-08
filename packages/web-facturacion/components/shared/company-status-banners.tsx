"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";

export function CompanyStatusBanners() {
  const { company, isLoading } = useAuth();
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  // Esperar a que tengamos datos confirmados de la empresa
  useEffect(() => {
    if (!isLoading && company && company.status !== undefined) {
      setHasCheckedStatus(true);
    }
  }, [isLoading, company]);

  // No mostrar hasta que hayamos confirmado el estado
  if (!hasCheckedStatus || isLoading || !company) {
    return null;
  }

  return (
    <>
      {/* Cuenta en revisión */}
      {company.status === "PENDING" && (
        <Alert variant="info" className="mb-6">
          <Clock className="h-4 w-4" />
          <AlertTitle>Cuenta en revisión</AlertTitle>
          <AlertDescription>
            Tu empresa está siendo revisada por nuestro equipo. Mientras tanto,
            puedes usar el sistema en <strong>modo TEST</strong>. Recibirás un
            email cuando tu cuenta sea aprobada.
          </AlertDescription>
        </Alert>
      )}

      {/* Cuenta aprobada en modo TEST */}
      {company.status === "APPROVED" && company.environment === "TEST" && (
        <Alert variant="success" className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Cuenta aprobada</AlertTitle>
          <AlertDescription>
            Tu empresa ha sido aprobada. Actualmente estás en{" "}
            <strong>modo TEST</strong>. Contacta a soporte para activar el modo
            PRODUCCIÓN.
          </AlertDescription>
        </Alert>
      )}

      {/* Cuenta rechazada */}
      {company.status === "REJECTED" && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cuenta rechazada</AlertTitle>
          <AlertDescription>
            {company.rejectionReason ||
              "Tu solicitud ha sido rechazada. Contacta a soporte para más información."}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
