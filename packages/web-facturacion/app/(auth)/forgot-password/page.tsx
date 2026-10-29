'use client';

import { useState } from 'react';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import Link from 'next/link';
import { authApi } from '@/lib/api/auth';

import { forgotPasswordSchema, ForgotPasswordFormData } from '@/lib/validations/schemas';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import { FormField, Alert, AlertDescription } from '@facturador-sri/ui';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setError(null);
      setIsLoading(true);
      await authApi.forgotPassword(data.email);
      setSentTo(data.email);
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo enviar el correo. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-container-low to-surface-container-high p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Recuperar contraseña</CardTitle>
          <CardDescription className="text-center">
            Te enviaremos un enlace para elegir una nueva
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sentTo ? (
            <div className="flex flex-col items-center py-4 space-y-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="text-sm text-muted-foreground">
                Si <strong className="text-foreground">{sentTo}</strong> está registrado, te llegará
                un correo con el enlace en unos minutos. Vence en 1 hora.
              </p>
              <p className="text-sm text-muted-foreground">
                ¿No llega? Revisa la carpeta de spam o vuelve a pedirlo en un minuto.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSentTo(null)}>
                Usar otro email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField label="Email de tu cuenta" htmlFor="email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  autoComplete="email"
                  {...register('email')}
                  disabled={isLoading}
                />
              </FormField>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar enlace
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            ¿La recordaste?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Inicia sesión
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
