import type { Request, Response, NextFunction } from 'express';
import type { Rol } from './jwt.js';
import { ForbiddenError, UnauthorizedError } from './errors.js';

// ¿Podés? requiereRol('Administrador') no es el middleware: lo devuelve,
// igual que validar(schema). Va siempre después de autenticar.
export function requiereRol(...rolesPermitidos: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      next(new UnauthorizedError('Falta el token de autenticación'));
      return;
    }
    // El rol sale del token firmado, nunca del body: el cliente no puede elegirlo
    const rol = req.usuario.rol;
    if (!rolesPermitidos.some((permitido) => permitido === rol)) {
      next(new ForbiddenError('No tenés permiso para esta operación'));
      return;
    }
    next();
  };
}
