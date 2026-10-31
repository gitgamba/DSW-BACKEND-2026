import { Router } from 'express';
import { listar, agenda, obtener, crear, modificar, asignar, marcarRealizado, eliminar } from './movimiento.controller.js';
import { validar } from '../shared/validar.js';
import { asignarSchema, movimientoCrearSchema, movimientoModificarSchema, realizadoSchema } from './movimiento.schema.js';
import { autenticar } from '../shared/autenticar.js';
import { requiereRol } from '../shared/autorizar.js';

export const movimientoRouter = Router();

// Todos los roles entran; el service limita a Operador a sus propios movimientos.
movimientoRouter.use(autenticar);
const todos = requiereRol('Administrador', 'Supervisor', 'Operador');
const gestion = requiereRol('Administrador', 'Supervisor');

// /agenda va antes que /:id: si no, Express tomaría "agenda" como un id
movimientoRouter.get('/agenda', todos, agenda);
movimientoRouter.get('/', todos, listar);
movimientoRouter.get('/:id', todos, obtener);
movimientoRouter.post('/', gestion, validar(movimientoCrearSchema), crear);
movimientoRouter.patch('/:id', gestion, validar(movimientoModificarSchema), modificar);
movimientoRouter.patch('/:id/asignar', gestion, validar(asignarSchema), asignar);
movimientoRouter.patch('/:id/realizado', todos, validar(realizadoSchema), marcarRealizado);
movimientoRouter.delete('/:id', gestion, eliminar);
