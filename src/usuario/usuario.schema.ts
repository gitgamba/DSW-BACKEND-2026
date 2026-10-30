import { z } from 'zod';

export const usuarioCrearSchema = z.object({
  nombre: z.string().trim().min(3, 'Al menos 3 caracteres').max(50),
  // bcrypt solo tiene en cuenta los primeros 72 bytes
  password: z.string().min(8, 'Al menos 8 caracteres').max(72),
  tipoUsuarioId: z.number().int().positive(),
});

// PATCH: los mismos campos, pero todos opcionales
export const usuarioModificarSchema = usuarioCrearSchema.partial();

export type UsuarioCrear = z.infer<typeof usuarioCrearSchema>;
export type UsuarioModificar = z.infer<typeof usuarioModificarSchema>;
