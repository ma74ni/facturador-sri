'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { authApi } from '@/lib/api/auth';

type VerificationStatus = 'loading' | 'success' | 'error' | 'expired' | 'already-verified';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [message, setMessage] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no proporcionado');
      return;
    }

    verifyEmail(token);
  }, [token]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await apiClient.get(`/auth/verify-email?token=${token}`);

      if (response.data.alreadyVerified) {
        setStatus('already-verified');
        setMessage(response.data.message || 'Tu email ya ha sido verificado anteriormente');
      } else {
        setStatus('success');
        setMessage(response.data.message || 'Email verificado exitosamente');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Error al verificar el email';

      if (errorMessage.includes('expirado')) {
        setStatus('expired');
        setMessage('El token de verificación ha expirado');
      } else if (errorMessage.includes('ya utilizado')) {
        setStatus('already-verified');
        setMessage('Este link ya fue utilizado. Si ya verificaste tu email, puedes iniciar sesión normalmente.');
      } else if (errorMessage.includes('inválido')) {
        setStatus('error');
        setMessage('El token de verificación es inválido');
      } else {
        setStatus('error');
        setMessage(errorMessage);
      }
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      alert('Por favor ingresa tu email');
      return;
    }

    try {
      setResendingEmail(true);
      await authApi.resendVerification(email);
      setResendSuccess(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al enviar el email');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-container-low to-surface-container-high p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            Verificación de Email
          </CardTitle>
          <CardDescription>
            Sistema de Facturación Electrónica SRI
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-center text-muted-foreground">
                Verificando tu email...
              </p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-success" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-on-success-container">
                  ¡Email Verificado!
                </h3>
                <p className="text-muted-foreground">
                  {message}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ya puedes acceder a todas las funcionalidades del sistema.
                </p>
              </div>
              <Button onClick={handleGoToDashboard} className="w-full mt-4">
                Ir al Dashboard
              </Button>
            </div>
          )}

          {/* Already Verified */}
          {status === 'already-verified' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-primary" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-on-primary-container">
                  Email Ya Verificado
                </h3>
                <p className="text-muted-foreground">
                  {message}
                </p>
                <p className="text-sm text-muted-foreground">
                  Puedes iniciar sesión normalmente.
                </p>
              </div>
              <Button onClick={handleGoToLogin} className="w-full mt-4">
                Ir a Iniciar Sesión
              </Button>
            </div>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <XCircle className="h-16 w-16 text-warning" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-on-warning-container">
                  Token Expirado
                </h3>
                <p className="text-muted-foreground">
                  El link de verificación ha expirado (válido por 5 minutos).
                </p>
              </div>

              {resendSuccess ? (
                <div className="w-full space-y-4">
                  <div className="flex items-center gap-2 p-3 text-sm text-on-success-container bg-success-container border border-success-container rounded-md">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>Email enviado exitosamente. Revisa tu bandeja de entrada.</span>
                  </div>
                  <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                    Ir a Iniciar Sesión
                  </Button>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Ingresa tu email para recibir un nuevo link:
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={resendingEmail}
                    />
                  </div>
                  <Button
                    onClick={handleResendVerification}
                    disabled={resendingEmail}
                    className="w-full"
                  >
                    {resendingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Reenviar Email de Verificación
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <XCircle className="h-16 w-16 text-error" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-on-error-container">
                  Error de Verificación
                </h3>
                <p className="text-muted-foreground">
                  {message}
                </p>
              </div>
              <Button onClick={handleGoToLogin} variant="outline" className="w-full mt-4">
                Ir a Iniciar Sesión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// useSearchParams() exige un límite de Suspense para poder prerenderizar la página.
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-container-low to-surface-container-high p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold">Verificación de Email</CardTitle>
              <CardDescription>Sistema de Facturación Electrónica SRI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <p className="text-center text-muted-foreground">Verificando tu email...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
