"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import { authApi } from "@/lib/api/auth";

export function EmailVerificationBanner() {
  const { user, isLoading } = useAuth();
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  // Esperar a que tengamos datos confirmados del usuario
  useEffect(() => {
    if (!isLoading && user && user.emailVerified !== undefined) {
      setHasCheckedStatus(true);
    }
  }, [isLoading, user]);

  // No mostrar hasta que hayamos confirmado el estado
  // Solo mostrar si explícitamente emailVerified es false
  if (!hasCheckedStatus || isLoading || !user || user.emailVerified !== false) {
    return null;
  }

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => {
        setCooldownSeconds(cooldownSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Cargar cooldown desde localStorage al montar
  useEffect(() => {
    if (user?.email) {
      const cooldownKey = `resend-cooldown-${user.email}`;
      const savedCooldownEnd = localStorage.getItem(cooldownKey);

      if (savedCooldownEnd) {
        const endTime = parseInt(savedCooldownEnd);
        const now = Date.now();
        const remainingSeconds = Math.floor((endTime - now) / 1000);

        if (remainingSeconds > 0) {
          setCooldownSeconds(remainingSeconds);
        } else {
          localStorage.removeItem(cooldownKey);
        }
      }
    }
  }, [user?.email]);

  const handleResendVerification = async () => {
    if (!user?.email || cooldownSeconds > 0) return;

    try {
      setResendError(null);
      setResendingEmail(true);
      await authApi.resendVerification(user.email);
      setResendSuccess(true);

      // Iniciar cooldown de 5 minutos (300 segundos)
      const cooldownDuration = 300;
      setCooldownSeconds(cooldownDuration);

      // Guardar tiempo de finalización del cooldown en localStorage
      const cooldownKey = `resend-cooldown-${user.email}`;
      const cooldownEnd = Date.now() + cooldownDuration * 1000;
      localStorage.setItem(cooldownKey, cooldownEnd.toString());

      // Ocultar mensaje de éxito después de 5 segundos
      setTimeout(() => {
        setResendSuccess(false);
      }, 5000);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Error al enviar el email";
      setResendError(errorMessage);

      // Si el error indica cooldown, extraer los minutos y sincronizar
      if (errorMessage.includes("Debes esperar")) {
        const minutesMatch = errorMessage.match(/(\d+) minutos/);
        if (minutesMatch) {
          const minutes = parseInt(minutesMatch[1]);
          const remainingSeconds = minutes * 60;
          setCooldownSeconds(remainingSeconds);

          // Guardar en localStorage
          const cooldownKey = `resend-cooldown-${user.email}`;
          const cooldownEnd = Date.now() + remainingSeconds * 1000;
          localStorage.setItem(cooldownKey, cooldownEnd.toString());
        }
      }

      // Ocultar mensaje de error después de 8 segundos (más tiempo para leer)
      setTimeout(() => {
        setResendError(null);
      }, 8000);
    } finally {
      setResendingEmail(false);
    }
  };

  // Formatear tiempo restante en MM:SS
  const formatCooldownTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <Alert variant="warning" className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Mail className="h-5 w-5 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <AlertTitle>Verifica tu correo electrónico</AlertTitle>
              <AlertDescription>
                Hemos enviado un email de verificación a{" "}
                <strong>{user.email}</strong>. Por favor revisa tu bandeja de
                entrada y sigue las instrucciones.
              </AlertDescription>
            </div>

            {resendSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>
                  Email enviado exitosamente. Revisa tu bandeja de entrada.
                </span>
              </div>
            )}

            {resendError && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{resendError}</span>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleResendVerification}
              disabled={resendingEmail || resendSuccess || cooldownSeconds > 0}
              className="bg-white"
            >
              {resendingEmail ? (
                "Enviando..."
              ) : resendSuccess ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Enviado
                </>
              ) : cooldownSeconds > 0 ? (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Espera {formatCooldownTime(cooldownSeconds)}
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Reenviar email de verificación
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}
