import { prisma } from '../shared/prisma.js';
import { NotFoundError } from '../shared/errors.js';
import type { HuespedCrear, HuespedModificar } from './huesped.schema.js';

export async function listar() {
  return prisma.huesped.findMany({ orderBy: [{ apellido: 'asc' }, { nombres: 'asc' }] });
}

export async function obtener(id: number) {
  const huesped = await prisma.huesped.findUnique({ where: { id } });
  if (!huesped) {
    throw new NotFoundError(`No existe el huésped ${id}`);
  }
  return huesped;
}

// Un staysId repetido lo rechaza la base (@unique) y el errorHandler responde 409
export async function crear(datos: HuespedCrear) {
  return prisma.huesped.create({ data: datos });
}

// Si el id no existe, Prisma lanza P2025 y el errorHandler responde 404
export async function modificar(id: number, datos: HuespedModificar) {
  return prisma.huesped.update({ where: { id }, data: datos });
}

// La relación con reservas es muchos a muchos: al borrarlo, solo desaparece de esas reservas
export async function eliminar(id: number) {
  await prisma.huesped.delete({ where: { id } });
}
