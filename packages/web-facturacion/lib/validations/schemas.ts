import { z } from 'zod';
import { validarCedula, validarRUC } from './ecuador';

// Schema para login
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Schema para registro
export const registerSchema = z.object({
  // Datos de la empresa
  ruc: z
    .string()
    .min(13, 'El RUC debe tener 13 dígitos')
    .max(13, 'El RUC debe tener 13 dígitos')
    .refine((val) => validarRUC(val), {
      message: 'RUC inválido',
    }),
  businessName: z
    .string()
    .min(1, 'La razón social es requerida')
    .min(3, 'La razón social debe tener al menos 3 caracteres'),
  tradeName: z.string().optional(),
  address: z
    .string()
    .min(1, 'La dirección es requerida'),
  phone: z.string().optional(),
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),

  // Datos del usuario
  firstName: z
    .string()
    .min(1, 'El nombre es requerido'),
  lastName: z
    .string()
    .min(1, 'El apellido es requerido'),
  userEmail: z
    .string()
    .min(1, 'El email del usuario es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z
    .string()
    .min(1, 'Confirma tu contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

// Schema para cliente
export const clienteSchema = z.object({
  identificationType: z.enum(['CEDULA', 'RUC', 'PASAPORTE'], {
    required_error: 'Selecciona el tipo de identificación',
  }),
  identification: z
    .string()
    .min(1, 'La identificación es requerida'),
  businessName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validar según tipo de identificación
  if (data.identificationType === 'CEDULA') {
    if (data.identification.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cédula debe tener 10 dígitos',
        path: ['identification'],
      });
    } else if (!validarCedula(data.identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cédula inválida',
        path: ['identification'],
      });
    }
  }

  if (data.identificationType === 'RUC') {
    if (data.identification.length !== 13) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El RUC debe tener 13 dígitos',
        path: ['identification'],
      });
    } else if (!validarRUC(data.identification)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RUC inválido',
        path: ['identification'],
      });
    }
  }

  // Validar que tenga nombre o razón social
  if (!data.businessName && (!data.firstName || !data.lastName)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Debes proporcionar razón social o nombres y apellidos',
      path: ['businessName'],
    });
  }
});

export type ClienteFormData = z.infer<typeof clienteSchema>;
