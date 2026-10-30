import type { Request, Response } from 'express';
import * as service from './auth.service.js';

// Sin try/catch: Express 5 manda solo al errorHandler los errores de las funciones async.

export async function login(req: Request, res: Response) {
  res.json(await service.login(req.body));
}
