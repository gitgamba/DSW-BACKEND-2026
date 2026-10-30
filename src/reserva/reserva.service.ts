import { prisma } from '../shared/prisma.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import type { ReservaCrear, ReservaFiltros, ReservaModificar } from './reserva.schema.js';

// Toda reserva nace con su check-in y su check-out pendientes y sin operador asignado.
// La fecha y hora planeadas son las de la reserva; en el movimiento se guarda cuándo se hizo.
export const MOVIMIENTOS_INICIALES = [{ tipo: 'CHECK_IN' }, { tipo: 'CHECK_OUT' }];

// Lo que trae el detalle de una reserva
const DETALLE = {
  inmueble: true,
  huespedes: true,
  movimientos: { include: { usuario: true }, orderBy: { tipo: 'asc' } }, // CHECK_IN antes que CHECK_OUT
} as const;

export async function listar(filtros: ReservaFiltros) {
  return prisma.reserva.findMany({
    where: {
      // Rango: las reservas que se cruzan con [desde, hasta], es decir,
      // que empiezan antes de que termine el rango y terminan después de que empiece.
      fechaInicio: filtros.hasta ? { lte: new Date(filtros.hasta) } : undefined,
      fechaFin: filtros.desde ? { gte: new Date(filtros.desde) } : undefined,
      inmuebleId: filtros.inmuebleId,
      movimientos: filtros.usuarioId ? { some: { usuarioId: filtros.usuarioId } } : undefined,
    },
    include: { inmueble: true },
    orderBy: [{ fechaInicio: 'asc' }, { horaInicio: 'asc' }],
  });
}

export async function obtener(id: number) {
  const reserva = await prisma.reserva.findUnique({ where: { id }, include: DETALLE });
  if (!reserva) {
    throw new NotFoundError(`No existe la reserva ${id}`);
  }
  return reserva;
}

// usuarioId: el administrador que la carga (sale del token, no del body)
export async function crear(datos: ReservaCrear, usuarioId: number) {
  verificarFechas(datos.fechaInicio, datos.fechaFin);
  await verificarInmueble(datos.inmuebleId);
  await verificarHuespedes(datos.huespedIds);
  return prisma.reserva.create({
    data: {
      staysId: datos.staysId,
      fechaInicio: new Date(datos.fechaInicio),
      horaInicio: datos.horaInicio,
      fechaFin: new Date(datos.fechaFin),
      horaFin: datos.horaFin,
      titular: datos.titular,
      costoEstadia: datos.costoEstadia,
      moneda: datos.moneda,
      costo: datos.costo,
      fechaCosto: datos.fechaCosto ? new Date(datos.fechaCosto) : null,
      inmuebleId: datos.inmuebleId,
      usuarioId,
      huespedes: { connect: (datos.huespedIds ?? []).map((id) => ({ id })) },
      movimientos: { create: MOVIMIENTOS_INICIALES },
    },
    include: DETALLE,
  });
}

export async function modificar(id: number, datos: ReservaModificar) {
  const actual = await obtener(id); // 404 si no existe
  // Si cambia una sola de las fechas, se compara contra la que ya tenía
  verificarFechas(datos.fechaInicio ?? aTexto(actual.fechaInicio), datos.fechaFin ?? aTexto(actual.fechaFin));
  if (datos.inmuebleId !== undefined) {
    await verificarInmueble(datos.inmuebleId);
  }
  await verificarHuespedes(datos.huespedIds);
  return prisma.reserva.update({
    where: { id },
    data: {
      staysId: datos.staysId,
      fechaInicio: datos.fechaInicio ? new Date(datos.fechaInicio) : undefined,
      horaInicio: datos.horaInicio,
      fechaFin: datos.fechaFin ? new Date(datos.fechaFin) : undefined,
      horaFin: datos.horaFin,
      titular: datos.titular,
      costoEstadia: datos.costoEstadia,
      moneda: datos.moneda,
      costo: datos.costo,
      // undefined = no tocar, null = borrarla, texto = la nueva fecha
      fechaCosto: datos.fechaCosto ? new Date(datos.fechaCosto) : datos.fechaCosto,
      inmuebleId: datos.inmuebleId,
      // set reemplaza la lista completa de huéspedes por la que mandaron
      huespedes: datos.huespedIds ? { set: datos.huespedIds.map((id) => ({ id })) } : undefined,
    },
    include: DETALLE,
  });
}

// Sus movimientos (y las notificaciones de esos movimientos) se borran en cascada
export async function eliminar(id: number) {
  await prisma.reserva.delete({ where: { id } });
}

// Las fechas AAAA-MM-DD se pueden comparar como texto
function verificarFechas(fechaInicio: string, fechaFin: string) {
  if (fechaFin < fechaInicio) {
    throw new ValidationError('La fecha de fin no puede ser anterior a la de inicio');
  }
}

function aTexto(fecha: Date) {
  return fecha.toISOString().slice(0, 10); // AAAA-MM-DD
}

// Sin estos chequeos, un id inexistente llegaría a la base como error de clave foránea,
// con un mensaje mucho menos claro.
async function verificarInmueble(inmuebleId: number) {
  const inmueble = await prisma.inmueble.findUnique({ where: { id: inmuebleId } });
  if (!inmueble) {
    throw new ValidationError(`No existe el inmueble ${inmuebleId}`);
  }
}

async function verificarHuespedes(huespedIds: number[] | undefined) {
  if (!huespedIds) {
    return;
  }
  const encontrados = await prisma.huesped.count({ where: { id: { in: huespedIds } } });
  if (encontrados !== new Set(huespedIds).size) {
    throw new ValidationError('Alguno de los huéspedes no existe');
  }
}
