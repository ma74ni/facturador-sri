'use client';

import { Suspense, useState } from 'react';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { useRouter, useSearchParams } from 'next/navigation';

import Link from 'next/link';
import { authApi } from '@/lib/api/auth';

import { resetPasswordSchema, ResetPasswordFormData } from '@/lib/validations/schemas';

import { Button } from '@/components/ui/button';

import { PasswordInput } from '@/components/ui/password-input';

import { FormField, Alert, AlertDescription } from '@facturador-sri/ui';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { AlertCircle, CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;
    try {
      setError(null);
      setIsLoading(true);
      await authApi.resetPassword(token, data.password);
      // Una sesión abierta en este navegador quedó invalidada por el cambio.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setDone(true);
    } catch (err: any) {
      const message = err.response?.data?.message;
      setError(
        Array.isArray(message) ? message[0] : message || 'No se pudo cambiar la contraseña.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center py-4 space-y-4 text-center">
        <XCircle className="h-12 w-12 text-error" />
        <p className="text-sm text-muted-foreground">
          El enlace está incompleto. Ábrelo de nuevo desde el correo o solicita uno nuevo.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Solicitar un enlace nuevo</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-4 space-y-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <p className="text-sm text-muted-foreground">
          Tu contraseña fue actualizada. Las sesiones abiertas en otros dispositivos se cerraron.
        </p>
        <Button className="w-full" onClick={() => router.push('/login')}>
          Iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            {error}{' '}
            <Link href="/forgot-password" className="font-medium underline">
              Pedir otro enlace
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <FormField label="Nueva contraseña" htmlFor="password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          {...register('password')}
          disabled={isLoading}
        />
      </FormField>

      <FormField
        label="Repite la contraseña"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          {...register('confirmPassword')}
          disabled={isLoading}
        />
      </FormField>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <KeyRound className="mr-2 h-4 w-4" />
            Guardar contraseña
          </>
        )}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-container-low to-surface-container-high p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Nueva contraseña</CardTitle>
          <CardDescription className="text-center">
            Sistema de Facturación Electrónica SRI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* useSearchParams() exige un límite de Suspense para poder prerenderizar la página. */}
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            }
          >
            <ResetPasswordContent />
          </Suspense>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Volver a iniciar sesión
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
