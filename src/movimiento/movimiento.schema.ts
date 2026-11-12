import { z } from 'zod';
import { fechaSchema, horaSchema } from '../shared/validar.js';

// Alta manual: las reservas ya nacen con sus dos movimientos, así que esto sirve
// para volver a crear uno que se borró. El operador se asigna aparte (PATCH /:id/asignar).
export const movimientoCrearSchema = z.object({
  reservaId: z.number().int().positive(),
  tipo: z.enum(['CHECK_IN', 'CHECK_OUT']),
  descripcion: z.string().trim().max(500).nullable().optional(),
});

// Edición de Administrador/Supervisor. Para marcarlo REALIZADO está PATCH /:id/realizado,
// que además guarda cuándo se hizo.
export const movimientoModificarSchema = z.object({
  descripcion: z.string().trim().max(500).nullable().optional(),
  estado: z.enum(['PENDIENTE', 'CANCELADO']).optional(),
});

// null = sacarle el operador
export const asignarSchema = z.object({
  usuarioId: z.number().int().positive().nullable(),
});

// Si no mandan fecha y hora, el service usa las de este momento
export const realizadoSchema = z.object({
  fechaRealizado: fechaSchema.optional(),
  horaRealizado: horaSchema.optional(),
});

// Llegan por query string (todo es texto), por eso coerce en el número
export const agendaSchema = z.object({
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  // Solo 'true': con coerce.boolean, el texto "false" daría true
  sinAsignar: z.literal('true').optional(),
});

export type MovimientoCrear = z.infer<typeof movimientoCrearSchema>;
export type MovimientoModificar = z.infer<typeof movimientoModificarSchema>;
export type Asignar = z.infer<typeof asignarSchema>;
export type Realizado = z.infer<typeof realizadoSchema>;
export type AgendaFiltros = z.infer<typeof agendaSchema>;
