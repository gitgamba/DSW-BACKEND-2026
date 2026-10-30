import type { Request, Response } from 'express';
import * as service from './inmueble.service.js';
import { idSchema } from '../shared/validar.js';

// Sin try/catch: Express 5 manda solo al errorHandler los errores de las funciones async.

export async function listar(req: Request, res: Response) {
  res.json(await service.listar());
}

export async function obtener(req: Request, res: Response) {
  res.json(await service.obtener(idSchema.parse(req.params).id));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(await service.crear(req.body));
}

export async function modificar(req: Request, res: Response) {
  res.json(await service.modificar(idSchema.parse(req.params).id, req.body));
}

export async function eliminar(req: Request, res: Response) {
  await service.eliminar(idSchema.parse(req.params).id);
  res.status(204).end();
}
