import { Router } from 'express';
import { login } from './auth.controller.js';
import { validar } from '../shared/validar.js';
import { loginSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/login', validar(loginSchema), login); // pública: es la puerta de entrada
