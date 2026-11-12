import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';

export type Rol = 'Administrador' | 'Supervisor' | 'Operador';

// El payload se puede leer sin el secret (base64 no es encriptación):
// solo lleva datos que el usuario ya sabe de sí mismo, nunca la contraseña ni el hash.
const payloadSchema = z.object({
  sub: z.string(), // id del usuario (JWT lo define como string)
  rol: z.enum(['Administrador', 'Supervisor', 'Operador']), // independiente del nombre del puesto
});

export type PayloadToken = z.infer<typeof payloadSchema>;

export function emitirToken(payload: PayloadToken): string {
  return jwt.sign(payload, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' }); // una jornada de trabajo
}

// verify (nunca decode) chequea la firma y el vencimiento. El algoritmo lo fija el servidor,
// no el header del token. Si algo falla, lanza un error y el que llama lo convierte en 401.
export function verificarToken(token: string): PayloadToken {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  return payloadSchema.parse(payload);
}
