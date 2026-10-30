import bcrypt from 'bcrypt';
import { prisma } from '../shared/prisma.js';
import { UnauthorizedError } from '../shared/errors.js';
import { emitirToken } from '../shared/jwt.js';
import type { LoginInput } from './auth.schema.js';

// Si el usuario no existe se compara igual contra este hash, para que las dos
// respuestas tarden lo mismo y el tiempo no delate qué nombres están registrados.
const HASH_DESCARTABLE = await bcrypt.hash('no-es-la-contraseña-de-nadie', 10);

export async function login(datos: LoginInput) {
  // Sin include: en SQL Server Prisma trae la relación con una segunda consulta, que solo
  // correría si el usuario existe y haría que esa respuesta tarde más.
  const usuario = await prisma.usuario.findUnique({
    where: { nombre: datos.nombre },
    omit: { passwordHash: false }, // acá sí hace falta el hash (el cliente global lo omite)
  });

  const coincide = await bcrypt.compare(datos.password, usuario?.passwordHash ?? HASH_DESCARTABLE);

  // Un solo mensaje para los dos casos: no revelar si existe el usuario
  if (!usuario || !coincide) {
    throw new UnauthorizedError('Credenciales inválidas');
  }

  // Recién con las credenciales validadas se busca el tipo, que define el rol
  const tipoUsuario = await prisma.tipoUsuario.findUniqueOrThrow({ where: { id: usuario.tipoUsuarioId } });
  const token = emitirToken({ sub: String(usuario.id), rol: tipoUsuario.descripcion });
  const { passwordHash, ...usuarioSinHash } = usuario; // el hash no sale nunca
  return { token, usuario: { ...usuarioSinHash, tipoUsuario } };
}
