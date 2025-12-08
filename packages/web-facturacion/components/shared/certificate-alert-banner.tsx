"use client";

import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowRight, X } from "lucide-react";
import { useCertificateStatus } from "@/lib/hooks/use-certificate";
import { useState } from "react";

export function CertificateAlertBanner() {
  const router = useRouter();
  const { data: certificateStatus, isLoading } = useCertificateStatus();
  const [dismissed, setDismissed] = useState(false);

  // No mostrar si está cargando, si no hay datos aún, si tiene certificado, o si fue descartado
  if (isLoading || !certificateStatus || certificateStatus.hasCertificate || dismissed) {
    return null;
  }

  const handleGoToConfiguration = () => {
    router.push("/dashboard/configuracion?tab=certificado");
  };

  console.log("certificateStatus:", certificateStatus);

  return (
    <Alert className="border-amber-200 bg-amber-50 relative">
      <ShieldAlert className="h-5 w-5 text-amber-600" />
      <AlertTitle className="text-amber-900 font-semibold flex items-center justify-between pr-8">
        Certificado Digital Requerido 2
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-amber-100"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </Button>
      </AlertTitle>
      <AlertDescription className="text-amber-800 mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm">
            Necesitas cargar tu{" "}
            <strong>archivo de firma electrónica (.p12)</strong> para poder
            firmar y enviar facturas electrónicas al SRI.
          </p>
          <Button
            onClick={handleGoToConfiguration}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0 w-full sm:w-auto"
          >
            Cargar Certificado
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
