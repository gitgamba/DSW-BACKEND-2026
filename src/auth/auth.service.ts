import bcrypt from 'bcrypt';
import { prisma } from '../shared/prisma.js';
import { UnauthorizedError } from '../shared/errors.js';
import { emitirToken, type Rol } from '../shared/jwt.js';
import type { LoginInput } from './auth.schema.js';

export async function login(datos: LoginInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { nombre: datos.nombre },
    include: { tipoUsuario: true }, // su tipo define el rol del token
    omit: { passwordHash: false }, // acá sí hace falta el hash (el cliente global lo omite)
  });

  // Un solo mensaje para los dos casos: no revelar si existe el usuario
  if (!usuario || !(await bcrypt.compare(datos.password, usuario.passwordHash))) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  const token = emitirToken({ sub: String(usuario.id), rol: usuario.tipoUsuario.rolBase as Rol });
  const { passwordHash, ...usuarioSinHash } = usuario; // el hash no sale nunca
  return { token, usuario: usuarioSinHash };
}
