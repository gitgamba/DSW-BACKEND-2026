import type { Request, Response } from 'express';
import * as service from './reserva.service.js';
import { sincronizar as sincronizarConStays } from './sincronizacion.service.js';
import { idSchema } from '../shared/validar.js';
import { reservaFiltrosSchema, sincronizarSchema } from './reserva.schema.js';

// Sin try/catch: Express 5 manda solo al errorHandler los errores de las funciones async.

export async function listar(req: Request, res: Response) {
  res.json(await service.listar(reservaFiltrosSchema.parse(req.query)));
}

export async function obtener(req: Request, res: Response) {
  res.json(await service.obtener(idSchema.parse(req.params).id));
}

export async function crear(req: Request, res: Response) {
  // autenticar ya dejó el usuario del token en req.usuario; sub es su id
  res.status(201).json(await service.crear(req.body, Number(req.usuario!.sub)));
}

export async function modificar(req: Request, res: Response) {
  res.json(await service.modificar(idSchema.parse(req.params).id, req.body));
}

export async function eliminar(req: Request, res: Response) {
  await service.eliminar(idSchema.parse(req.params).id);
  res.status(204).end();
}

export async function sincronizar(req: Request, res: Response) {
  res.json(await sincronizarConStays(sincronizarSchema.parse(req.query)));
}
