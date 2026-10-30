import { prisma } from '../shared/prisma.js';
import { ConflictError, NotFoundError } from '../shared/errors.js';
import type { TipoUsuarioInput } from './tipo-usuario.schema.js';

export async function listar() {
  return prisma.tipoUsuario.findMany({ orderBy: { id: 'asc' } });
}

export async function obtener(id: number) {
  const tipo = await prisma.tipoUsuario.findUnique({ where: { id } });
  if (!tipo) {
    throw new NotFoundError(`No existe el tipo de usuario ${id}`);
  }
  return tipo;
}

// Una descripción repetida la rechaza la base (@unique) y el errorHandler responde 409
export async function crear(datos: TipoUsuarioInput) {
  return prisma.tipoUsuario.create({ data: datos });
}

export async function modificar(id: number, datos: TipoUsuarioInput) {
  await verificarQueNoEsBase(id);
  return prisma.tipoUsuario.update({ where: { id }, data: datos });
}

// Si todavía hay usuarios de este tipo, la base lo impide (P2003) y se responde 409
export async function eliminar(id: number) {
  await verificarQueNoEsBase(id);
  await prisma.tipoUsuario.delete({ where: { id } });
}

// Los permisos se deciden por la descripción del tipo (es el "rol" del token):
// si se renombra o borra uno de estos, sus usuarios pierden el acceso.
const TIPOS_BASE = ['Administrador', 'Supervisor', 'Limpieza'];

async function verificarQueNoEsBase(id: number) {
  const tipo = await obtener(id); // de paso, 404 si no existe
  if (TIPOS_BASE.includes(tipo.descripcion)) {
    throw new ConflictError(`El tipo ${tipo.descripcion} es del sistema: no se puede modificar ni borrar`);
  }
}
