import bcrypt from 'bcrypt';
import { prisma } from '../shared/prisma.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import type { UsuarioCrear, UsuarioModificar } from './usuario.schema.js';
import { ROLES_ASIGNABLES } from '../movimiento/movimiento.service.js';

// El passwordHash nunca viaja: el cliente de shared/prisma.ts lo omite siempre.

export async function listar() {
  return prisma.usuario.findMany({ include: { tipoUsuario: true }, orderBy: { id: 'asc' } });
}

// Para el desplegable de asignar movimientos: solo id y nombre, así el Supervisor
// puede usarlo sin ver el resto de los usuarios.
export async function listarOperadores() {
  return prisma.usuario.findMany({
    where: { tipoUsuario: { rolBase: { in: ROLES_ASIGNABLES } } },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function obtener(id: number) {
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { tipoUsuario: true } });
  if (!usuario) {
    throw new NotFoundError(`No existe el usuario ${id}`);
  }
  return usuario;
}

export async function crear(datos: UsuarioCrear) {
  await verificarTipoUsuario(datos.tipoUsuarioId);
  return prisma.usuario.create({
    data: {
      nombre: datos.nombre,
      passwordHash: await bcrypt.hash(datos.password, 10), // la contraseña nunca se guarda tal cual
      tipoUsuarioId: datos.tipoUsuarioId,
    },
    include: { tipoUsuario: true },
  });
}

// Si el id no existe, Prisma lanza P2025 y el errorHandler responde 404
export async function modificar(id: number, datos: UsuarioModificar) {
  if (datos.tipoUsuarioId !== undefined) {
    const tipoNuevo = await verificarTipoUsuario(datos.tipoUsuarioId);
    if (tipoNuevo.rolBase !== 'Administrador') {
      await verificarQueNoEsUltimoAdmin(id); // pasarlo a otro tipo es como sacarlo de admin
    }
  }
  return prisma.usuario.update({
    where: { id },
    data: {
      nombre: datos.nombre,
      tipoUsuarioId: datos.tipoUsuarioId,
      // Solo se vuelve a hashear si mandaron una contraseña nueva (undefined = no tocar)
      passwordHash: datos.password ? await bcrypt.hash(datos.password, 10) : undefined,
    },
    include: { tipoUsuario: true },
  });
}

// Si tiene reservas creadas o movimientos asignados, la base lo impide (P2003) y se responde 409
export async function eliminar(id: number) {
  await verificarQueNoEsUltimoAdmin(id);
  await prisma.usuario.delete({ where: { id } });
}

// Solo un Administrador puede dar de alta usuarios: si se va el último, nadie más puede entrar a gestionar.
// ponytail: dos pedidos simultáneos sobre los dos últimos admins podrían pasar los dos; una transacción
// serializable lo cierra si alguna vez hace falta.
async function verificarQueNoEsUltimoAdmin(id: number) {
  const usuario = await obtener(id); // de paso, 404 si no existe
  if (usuario.tipoUsuario.rolBase !== 'Administrador') {
    return;
  }
  const cantidadAdmins = await prisma.usuario.count({ where: { tipoUsuario: { rolBase: 'Administrador' } } });
  if (cantidadAdmins === 1) {
    throw new ConflictError('No se puede dejar el sistema sin administradores');
  }
}

// Sin este chequeo, un tipo inexistente llegaría a la base como error de clave foránea,
// con un mensaje mucho menos claro.
async function verificarTipoUsuario(tipoUsuarioId: number) {
  const tipo = await prisma.tipoUsuario.findUnique({ where: { id: tipoUsuarioId } });
  if (!tipo) {
    throw new ValidationError(`No existe el tipo de usuario ${tipoUsuarioId}`);
  }
  return tipo;
}
