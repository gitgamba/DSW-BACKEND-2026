import type { Request, Response } from 'express';
import * as service from './movimiento.service.js';
import { idSchema } from '../shared/validar.js';
import { agendaSchema } from './movimiento.schema.js';

// Sin try/catch: Express 5 manda solo al errorHandler los errores de las funciones async.
// req.usuario! : autenticar ya corrió antes, así que siempre está.

export async function listar(req: Request, res: Response) {
  res.json(await service.listar(req.usuario!));
}

export async function agenda(req: Request, res: Response) {
  res.json(await service.agenda(agendaSchema.parse(req.query), req.usuario!));
}

export async function obtener(req: Request, res: Response) {
  res.json(await service.obtener(idSchema.parse(req.params).id, req.usuario!));
}

export async function crear(req: Request, res: Response) {
  res.status(201).json(await service.crear(req.body));
}

export async function modificar(req: Request, res: Response) {
  res.json(await service.modificar(idSchema.parse(req.params).id, req.body));
}

export async function asignar(req: Request, res: Response) {
  res.json(await service.asignar(idSchema.parse(req.params).id, req.body));
}

export async function marcarRealizado(req: Request, res: Response) {
  res.json(await service.marcarRealizado(idSchema.parse(req.params).id, req.body, req.usuario!));
}

export async function eliminar(req: Request, res: Response) {
  await service.eliminar(idSchema.parse(req.params).id);
  res.status(204).end();
}
