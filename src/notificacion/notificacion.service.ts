import { prisma } from '../shared/prisma.js';
import { ForbiddenError, NotFoundError } from '../shared/errors.js';
import type { MisNotificacionesFiltros } from './notificacion.schema.js';

// Las notificaciones se crean solas al asignar un movimiento (movimiento.service).
// No tienen usuario propio: su dueño es el operador asignado a ese movimiento.

export async function mias(usuarioId: number, filtros: MisNotificacionesFiltros) {
  return prisma.notificacion.findMany({
    where: {
      movimiento: { usuarioId },
      leida: filtros.noLeidas === 'true' ? false : undefined, // undefined = todas
    },
    orderBy: { id: 'desc' }, // las más nuevas primero
  });
}

export async function marcarLeida(id: number, usuarioId: number) {
  const notificacion = await prisma.notificacion.findUnique({ where: { id }, include: { movimiento: true } });
  if (!notificacion) {
    throw new NotFoundError(`No existe la notificación ${id}`);
  }
  if (notificacion.movimiento.usuarioId !== usuarioId) {
    throw new ForbiddenError('Esa notificación no es tuya');
  }
  return prisma.notificacion.update({ where: { id }, data: { leida: true } });
}
