import { z } from 'zod';

export const tipoUsuarioSchema = z.object({
  descripcion: z.string().trim().min(1, 'No puede estar vacía').max(50),
  rolBase: z.enum(['Administrador', 'Supervisor', 'Operador']),
});

// El tipo sale del esquema: una sola fuente de verdad
export type TipoUsuarioInput = z.infer<typeof tipoUsuarioSchema>;
