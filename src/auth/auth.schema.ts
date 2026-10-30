import { z } from 'zod';

export const loginSchema = z.object({
  nombre: z.string().trim().min(1, 'Ingresá el nombre de usuario'),
  password: z.string().min(1, 'Ingresá la contraseña'),
});

export type LoginInput = z.infer<typeof loginSchema>;
