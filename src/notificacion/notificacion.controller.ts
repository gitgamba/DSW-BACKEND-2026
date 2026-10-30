import type { Request, Response } from 'express';
import * as service from './notificacion.service.js';
import { idSchema } from '../shared/validar.js';
import { misNotificacionesSchema } from './notificacion.schema.js';

// Sin try/catch: Express 5 manda solo al errorHandler los errores de las funciones async.
// El usuario sale del token (autenticar ya corrió): nadie puede pedir las de otro.

export async function mias(req: Request, res: Response) {
  res.json(await service.mias(Number(req.usuario!.sub), misNotificacionesSchema.parse(req.query)));
}

export async function marcarLeida(req: Request, res: Response) {
  res.json(await service.marcarLeida(idSchema.parse(req.params).id, Number(req.usuario!.sub)));
}
