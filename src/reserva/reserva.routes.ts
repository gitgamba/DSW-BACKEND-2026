import { Router } from 'express';
import { listar, obtener, crear, modificar, eliminar, sincronizar } from './reserva.controller.js';
import { validar } from '../shared/validar.js';
import { reservaCrearSchema, reservaModificarSchema } from './reserva.schema.js';
import { autenticar } from '../shared/autenticar.js';
import { requiereRol } from '../shared/autorizar.js';

export const reservaRouter = Router();

// Leer: Administrador y Supervisor. Crear, modificar, borrar y sincronizar: solo Administrador.
reservaRouter.use(autenticar);
const lectura = requiereRol('Administrador', 'Supervisor');
const escritura = requiereRol('Administrador');

reservaRouter.post('/sincronizar', escritura, sincronizar);
reservaRouter.get('/', lectura, listar);
reservaRouter.get('/:id', lectura, obtener);
reservaRouter.post('/', escritura, validar(reservaCrearSchema), crear);
reservaRouter.patch('/:id', escritura, validar(reservaModificarSchema), modificar);
reservaRouter.delete('/:id', escritura, eliminar);
