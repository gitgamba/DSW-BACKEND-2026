import { Router } from 'express';
import { mias, marcarLeida } from './notificacion.controller.js';
import { autenticar } from '../shared/autenticar.js';

export const notificacionRouter = Router();

// Cualquier usuario logueado, pero cada uno solo con las suyas (lo controla el service)
notificacionRouter.use(autenticar);

notificacionRouter.get('/mias', mias);
notificacionRouter.patch('/:id/leida', marcarLeida);
