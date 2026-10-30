import type { Request, Response, NextFunction } from 'express';
import { verificarToken } from './jwt.js';
import { UnauthorizedError } from './errors.js';

// ¿Quién sos? Lee el header "Authorization: Bearer <token>", lo verifica
// y deja el payload en req.usuario para los middlewares y controllers que siguen.
export function autenticar(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Falta el token de autenticación'));
    return;
  }
  try {
    req.usuario = verificarToken(header.slice('Bearer '.length));
    next();
  } catch {
    // Firma inválida, token vencido o payload con otra forma: para el cliente es lo mismo
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}
