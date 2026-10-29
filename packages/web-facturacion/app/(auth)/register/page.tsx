'use client';

import { useState, useEffect } from 'react';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { useAuth } from '@/lib/context/auth-context';

import { registerSchema, RegisterFormData } from '@/lib/validations/schemas';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

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

import { UserPlus, AlertCircle, Building2, User } from 'lucide-react';

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError(null);
      setIsLoading(true);
      await registerUser(data);
    } catch (err: any) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar loading mientras verifica autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-container-low to-surface-container-high">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // No renderizar nada si ya está autenticado (evita flash de contenido)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-container-low to-surface-container-high p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Crear Cuenta</CardTitle>
          <CardDescription className="text-center">
            Registra tu empresa para empezar a facturar electrónicamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Datos de la Empresa */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5" />
                <h3>Datos de la Empresa</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="RUC *" htmlFor="ruc" error={errors.ruc?.message}>
                  <Input
                    id="ruc"
                    placeholder="1234567890001"
                    maxLength={13}
                    {...register('ruc')}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField
                  label="Razón Social *"
                  htmlFor="businessName"
                  error={errors.businessName?.message}
                >
                  <Input
                    id="businessName"
                    placeholder="Mi Empresa S.A."
                    {...register('businessName')}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField
                  label="Nombre Comercial"
                  htmlFor="tradeName"
                  error={errors.tradeName?.message}
                >
                  <Input
                    id="tradeName"
                    placeholder="Mi Negocio"
                    {...register('tradeName')}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
                  <Input
                    id="phone"
                    placeholder="0987654321"
                    {...register('phone')}
                    disabled={isLoading}
                  />
                </FormField>
              </div>

              <FormField label="Dirección *" htmlFor="address" error={errors.address?.message}>
                <Input
                  id="address"
                  placeholder="Av. Principal y Calle Secundaria"
                  {...register('address')}
                  disabled={isLoading}
                />
              </FormField>

              <FormField label="Email Empresa *" htmlFor="email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  placeholder="empresa@ejemplo.com"
                  {...register('email')}
                  disabled={isLoading}
                />
              </FormField>
            </div>

            {/* Datos del Usuario */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <User className="h-5 w-5" />
                <h3>Datos del Administrador</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Nombre *" htmlFor="firstName" error={errors.firstName?.message}>
                  <Input
                    id="firstName"
                    placeholder="Juan"
                    {...register('firstName')}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="Apellido *" htmlFor="lastName" error={errors.lastName?.message}>
                  <Input
                    id="lastName"
                    placeholder="Pérez"
                    {...register('lastName')}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField
                  label="Email Usuario *"
                  htmlFor="userEmail"
                  error={errors.userEmail?.message}
                >
                  <Input
                    id="userEmail"
                    type="email"
                    placeholder="juan.perez@ejemplo.com"
                    {...register('userEmail')}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField label="Contraseña *" htmlFor="password" error={errors.password?.message}>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    {...register('password')}
                    disabled={isLoading}
                  />
                </FormField>

                <FormField
                  label="Confirmar Contraseña *"
                  htmlFor="confirmPassword"
                  error={errors.confirmPassword?.message}
                  className="md:col-span-2"
                >
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="••••••••"
                    {...register('confirmPassword')}
                    disabled={isLoading}
                  />
                </FormField>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                'Registrando...'
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear Cuenta
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Inicia sesión aquí
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
