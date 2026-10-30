import { z } from 'zod';

export const huespedCrearSchema = z.object({
  staysId: z.string().trim().min(1, 'No puede estar vacío').max(50), // el id del cliente en Stays
  apellido: z.string().trim().min(1, 'No puede estar vacío').max(100),
  nombres: z.string().trim().min(1, 'No puede estar vacío').max(100),
  dni: z.string().trim().max(20).nullable().optional(), // texto: puede ser un pasaporte
  nacionalidad: z.string().trim().max(50).nullable().optional(),
  confirmoInicio: z.boolean().optional(),
  confirmoFin: z.boolean().optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
  email: z.email('Email inválido').max(100).nullable().optional(),
});

// PATCH: los mismos campos, pero todos opcionales
export const huespedModificarSchema = huespedCrearSchema.partial();

export type HuespedCrear = z.infer<typeof huespedCrearSchema>;
export type HuespedModificar = z.infer<typeof huespedModificarSchema>;
