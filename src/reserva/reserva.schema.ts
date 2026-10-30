import { z } from 'zod';
import { fechaSchema as fecha, horaSchema as hora } from '../shared/validar.js';

// Sin .refine acá: Zod no deja hacer .partial() de un esquema con refinamientos.
// Que la fecha de fin no sea anterior a la de inicio lo controla el service.
export const reservaCrearSchema = z.object({
  staysId: z.string().trim().min(1, 'No puede estar vacío').max(50), // el id de la reserva en Stays
  fechaInicio: fecha,
  horaInicio: hora,
  fechaFin: fecha,
  horaFin: hora,
  titular: z.string().trim().min(1, 'No puede estar vacío').max(100),
  costoEstadia: z.number().nonnegative().nullable().optional(),
  moneda: z.string().regex(/^[A-Z]{3}$/, 'Código de 3 letras en mayúscula, por ejemplo USD o ARS').nullable().optional(), // la de costoEstadia
  costo: z.number().nonnegative().nullable().optional(),
  fechaCosto: fecha.nullable().optional(),
  inmuebleId: z.number().int().positive(),
  huespedIds: z.array(z.number().int().positive()).optional(), // ids de huéspedes ya cargados
});

// PATCH: los mismos campos, pero todos opcionales
export const reservaModificarSchema = reservaCrearSchema.partial();

// Filtros del listado. Llegan por query string (todo es texto), por eso coerce en los números.
export const reservaFiltrosSchema = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  inmuebleId: z.coerce.number().int().positive().optional(),
  usuarioId: z.coerce.number().int().positive().optional(), // el asignado a algún movimiento
});

// Rango de llegadas a traer de Stays; si no vienen, el service usa de hoy a dentro de 30 días
export const sincronizarSchema = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
});

export type ReservaCrear = z.infer<typeof reservaCrearSchema>;
export type ReservaModificar = z.infer<typeof reservaModificarSchema>;
export type ReservaFiltros = z.infer<typeof reservaFiltrosSchema>;
export type SincronizarInput = z.infer<typeof sincronizarSchema>;
