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
  const tipo = await obtener(id);
  // Cambiar el rol del tipo cambia los permisos de TODOS sus usuarios.
  if (tipo.rolBase === 'Administrador' && datos.rolBase !== 'Administrador') {
    const afectados = await prisma.usuario.count({ where: { tipoUsuarioId: id } });
    const otrosAdmins = await prisma.usuario.count({
      where: { tipoUsuario: { rolBase: 'Administrador' }, tipoUsuarioId: { not: id } },
    });
    if (afectados > 0 && otrosAdmins === 0) {
      throw new ConflictError('No se puede dejar el sistema sin administradores');
    }
  }
  return prisma.tipoUsuario.update({ where: { id }, data: datos });
}

// Si todavía hay usuarios de este tipo, la base lo impide (P2003) y se responde 409
export async function eliminar(id: number) {
  await prisma.tipoUsuario.delete({ where: { id } });
}
