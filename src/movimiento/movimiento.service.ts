import { prisma } from '../shared/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../shared/errors.js';
import { ahoraArgentina, fechaLegible } from '../shared/fecha.js';
import type { PayloadToken } from '../shared/jwt.js';
import type { AgendaFiltros, Asignar, MovimientoCrear, MovimientoModificar, Realizado } from './movimiento.schema.js';

// Decisión del usuario: los que pueden ir a hacer un check-in o un check-out
// (también la usa GET /usuarios/operadores, para listar a quién se puede asignar)
export const ROLES_ASIGNABLES = ['Limpieza', 'Supervisor'];

// Lo que acompaña a cada movimiento en las respuestas
const CON_RESERVA = { reserva: { include: { inmueble: true } }, usuario: true } as const;

// Limpieza solo ve y marca lo suyo; Administrador y Supervisor, todo.
// "quien" es el usuario del token (req.usuario), no algo que mande el cliente.
function esLimpieza(quien: PayloadToken) {
  return quien.rol === 'Limpieza';
}

export async function listar(quien: PayloadToken) {
  return prisma.movimiento.findMany({
    where: { usuarioId: esLimpieza(quien) ? Number(quien.sub) : undefined }, // undefined = sin filtro
    include: CON_RESERVA,
    orderBy: { id: 'asc' },
  });
}

export async function obtener(id: number, quien: PayloadToken) {
  const movimiento = await buscar(id);
  verificarQueEsSuyo(movimiento.usuarioId, quien);
  return movimiento;
}

// Si ya existe ese tipo para la reserva, @@unique([reservaId, tipo]) lo rechaza y se responde 409
export async function crear(datos: MovimientoCrear) {
  const reserva = await prisma.reserva.findUnique({ where: { id: datos.reservaId } });
  if (!reserva) {
    throw new ValidationError(`No existe la reserva ${datos.reservaId}`);
  }
  return prisma.movimiento.create({ data: datos, include: CON_RESERVA });
}

export async function modificar(id: number, datos: MovimientoModificar) {
  const movimiento = await buscar(id);
  verificarQueNoEstaCancelado(movimiento.estado);
  return prisma.movimiento.update({
    where: { id },
    data: {
      descripcion: datos.descripcion,
      estado: datos.estado,
      // Volver a PENDIENTE deshace un REALIZADO: ya no hay cuándo se hizo
      fechaRealizado: datos.estado === 'PENDIENTE' ? null : undefined,
      horaRealizado: datos.estado === 'PENDIENTE' ? null : undefined,
    },
    include: CON_RESERVA,
  });
}

// Su notificación (si tiene) se borra en cascada
export async function eliminar(id: number) {
  await prisma.movimiento.delete({ where: { id } });
}

// Asignar (o reasignar, o sacar con null) el operador, y avisarle con una notificación.
// Va en una transacción: o se guardan las dos cosas o ninguna, así nunca queda
// un movimiento asignado sin aviso, ni un aviso de algo que no se asignó.
export async function asignar(id: number, { usuarioId }: Asignar) {
  const movimiento = await buscar(id);
  verificarQueNoEstaCancelado(movimiento.estado);
  if (usuarioId !== null) {
    await verificarQueEsAsignable(usuarioId);
  }

  const { fecha, hora } = fechaYHora(movimiento);
  const inmueble = movimiento.reserva.inmueble;
  const que = movimiento.tipo === 'CHECK_IN' ? 'check-in' : 'check-out';
  const mensaje = `Te asignaron el ${que} del inmueble ${inmueble.id} (${inmueble.direccion}) el ${fechaLegible(fecha)} a las ${hora}`;
  const ahora = ahoraArgentina();
  const datosNotificacion = { mensaje, fecha: new Date(ahora.fecha), hora: ahora.hora, leida: false };

  // Sin operador no hay a quién avisarle: se borra la notificación.
  // Con operador: hay como mucho una por movimiento; si ya existía (reasignación), se reescribe
  // para el nuevo operador y vuelve a quedar sin leer. El dueño es el asignado del movimiento.
  const pasoNotificacion =
    usuarioId === null
      ? prisma.notificacion.deleteMany({ where: { movimientoId: id } })
      : prisma.notificacion.upsert({
          where: { movimientoId: id },
          create: { movimientoId: id, ...datosNotificacion },
          update: datosNotificacion,
        });
  const pasoMovimiento = prisma.movimiento.update({ where: { id }, data: { usuarioId }, include: CON_RESERVA });

  // $transaction recibe la lista de operaciones y las corre juntas: si una falla, se deshacen todas
  const resultados = await prisma.$transaction([pasoNotificacion, pasoMovimiento]);
  return resultados[1]; // el movimiento ya actualizado
}

export async function marcarRealizado(id: number, datos: Realizado, quien: PayloadToken) {
  const movimiento = await buscar(id);
  verificarQueEsSuyo(movimiento.usuarioId, quien);
  verificarQueNoEstaCancelado(movimiento.estado);
  const ahora = ahoraArgentina(); // si no mandan cuándo se hizo, es ahora
  return prisma.movimiento.update({
    where: { id },
    data: {
      estado: 'REALIZADO',
      fechaRealizado: new Date(datos.fechaRealizado ?? ahora.fecha),
      horaRealizado: datos.horaRealizado ?? ahora.hora,
    },
    include: CON_RESERVA,
  });
}

// La hoja de ruta: cada movimiento con la fecha y hora en que hay que ir, ordenada.
export async function agenda(filtros: AgendaFiltros, quien: PayloadToken) {
  // Limpieza siempre ve lo suyo, aunque pida otro usuarioId
  const usuarioId = esLimpieza(quien) ? Number(quien.sub) : filtros.usuarioId;
  const rango = {
    gte: filtros.desde ? new Date(filtros.desde) : undefined,
    lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
  };

  const movimientos = await prisma.movimiento.findMany({
    where: {
      usuarioId,
      // La fecha del check-in es el inicio de la reserva; la del check-out, el fin
      OR: [
        { tipo: 'CHECK_IN', reserva: { fechaInicio: rango } },
        { tipo: 'CHECK_OUT', reserva: { fechaFin: rango } },
      ],
    },
    include: CON_RESERVA,
  });

  // Se arma una fila plana por movimiento, lista para la lista por día o para FullCalendar
  const filas = movimientos.map((m) => {
    const { fecha, hora } = fechaYHora(m);
    return {
      id: m.id,
      tipo: m.tipo,
      estado: m.estado,
      fecha,
      hora,
      titular: m.reserva.titular,
      reservaId: m.reservaId,
      inmueble: { id: m.reserva.inmueble.id, direccion: m.reserva.inmueble.direccion },
      usuario: m.usuario ? { id: m.usuario.id, nombre: m.usuario.nombre } : null,
      descripcion: m.descripcion,
    };
  });
  // Ordenar en la base no alcanza: la fecha sale de columnas distintas según el tipo.
  // "2026-11-10" + "15:00" se puede comparar como texto.
  return filas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

async function buscar(id: number) {
  const movimiento = await prisma.movimiento.findUnique({ where: { id }, include: CON_RESERVA });
  if (!movimiento) {
    throw new NotFoundError(`No existe el movimiento ${id}`);
  }
  return movimiento;
}

function verificarQueEsSuyo(usuarioId: number | null, quien: PayloadToken) {
  if (esLimpieza(quien) && usuarioId !== Number(quien.sub)) {
    throw new ForbiddenError('Ese movimiento no está asignado a vos');
  }
}

// Un movimiento cancelado (por ejemplo, porque se canceló la reserva en Stays) queda congelado
function verificarQueNoEstaCancelado(estado: string) {
  if (estado === 'CANCELADO') {
    throw new ConflictError('El movimiento está cancelado: no se puede modificar');
  }
}

async function verificarQueEsAsignable(usuarioId: number) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { tipoUsuario: true } });
  if (!usuario) {
    throw new ValidationError(`No existe el usuario ${usuarioId}`);
  }
  if (!ROLES_ASIGNABLES.includes(usuario.tipoUsuario.descripcion)) {
    throw new ValidationError(`Solo se puede asignar a usuarios de ${ROLES_ASIGNABLES.join(' o ')}`);
  }
}

// El movimiento no guarda cuándo hay que hacerlo: sale de la reserva
function fechaYHora(m: { tipo: string; reserva: { fechaInicio: Date; horaInicio: string; fechaFin: Date; horaFin: string } }) {
  if (m.tipo === 'CHECK_IN') {
    return { fecha: m.reserva.fechaInicio.toISOString().slice(0, 10), hora: m.reserva.horaInicio };
  }
  return { fecha: m.reserva.fechaFin.toISOString().slice(0, 10), hora: m.reserva.horaFin };
}
