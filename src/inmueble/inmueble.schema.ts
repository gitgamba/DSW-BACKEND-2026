import { z } from 'zod';

export const inmuebleCrearSchema = z.object({
  staysId: z.string().trim().min(1, 'No puede estar vacío').max(50), // el id del listing en Stays
  direccion: z.string().trim().min(1, 'No puede estar vacía').max(200),
  precio: z.number().nonnegative().nullable().optional(),
  capacidad: z.number().int().positive().nullable().optional(),
  // SQL Server no tiene enums: los valores posibles se controlan acá
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
});

// PATCH: los mismos campos, pero todos opcionales
export const inmuebleModificarSchema = inmuebleCrearSchema.partial();

export type InmuebleCrear = z.infer<typeof inmuebleCrearSchema>;
export type InmuebleModificar = z.infer<typeof inmuebleModificarSchema>;
