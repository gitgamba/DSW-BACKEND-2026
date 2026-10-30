import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login } from './auth.controller.js';
import { validar } from '../shared/validar.js';
import { loginSchema } from './auth.schema.js';

export const authRouter = Router();

// Contra la fuerza bruta: cuenta los intentos fallidos de cada IP y, al pasarse,
// responde 429 sin llegar a comparar contraseñas.
// ponytail: el conteo vive en memoria; si un día hay varias instancias de la API, hace falta un store compartido.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  limit: 5, // 5 intentos fallidos por IP en esa ventana
  skipSuccessfulRequests: true, // los logins correctos no gastan intentos
  message: { error: 'Demasiados intentos de login, probá de nuevo en 15 minutos' },
});

authRouter.post('/login', limiteLogin, validar(loginSchema), login); // pública: es la puerta de entrada
