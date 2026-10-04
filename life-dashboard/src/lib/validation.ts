import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email no válido'),
  password: z.string().min(1, 'Introduce la contraseña').max(200),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1, 'Introduce tu nombre').max(80),
  password: z.string().min(10, 'Mínimo 10 caracteres').max(200),
});

export const layoutSchema = z.array(
  z.object({
    id: z.string().min(1).max(40),
    visible: z.boolean(),
    order: z.number().int().min(0).max(100),
    size: z.enum(['sm', 'md', 'lg']),
  }),
).max(40);

export type LoginInput = z.infer<typeof loginSchema>;
