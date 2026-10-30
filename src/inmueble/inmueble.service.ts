import { prisma } from '../shared/prisma.js';
import { NotFoundError } from '../shared/errors.js';
import type { InmuebleCrear, InmuebleModificar } from './inmueble.schema.js';

export async function listar() {
  return prisma.inmueble.findMany({ orderBy: { id: 'asc' } });
}

export async function obtener(id: number) {
  const inmueble = await prisma.inmueble.findUnique({ where: { id } });
  if (!inmueble) {
    throw new NotFoundError(`No existe el inmueble ${id}`);
  }
  return inmueble;
}

// Un staysId repetido lo rechaza la base (@unique) y el errorHandler responde 409
export async function crear(datos: InmuebleCrear) {
  return prisma.inmueble.create({ data: datos });
}

// Si el id no existe, Prisma lanza P2025 y el errorHandler responde 404
export async function modificar(id: number, datos: InmuebleModificar) {
  return prisma.inmueble.update({ where: { id }, data: datos });
}

// Si tiene reservas, la base lo impide (P2003) y se responde 409
export async function eliminar(id: number) {
  await prisma.inmueble.delete({ where: { id } });
}
