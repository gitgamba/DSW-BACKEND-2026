import { z } from 'zod';

// ?noLeidas=true. Llega como texto: z.coerce.boolean() convertiría "false" en true,
// por eso se aceptan exactamente "true" o "false".
export const misNotificacionesSchema = z.object({
  noLeidas: z.enum(['true', 'false']).optional(),
});

export type MisNotificacionesFiltros = z.infer<typeof misNotificacionesSchema>;
