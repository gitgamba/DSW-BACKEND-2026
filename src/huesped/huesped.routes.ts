import { Router } from 'express';
import { listar, obtener, crear, modificar, eliminar } from './huesped.controller.js';
import { validar } from '../shared/validar.js';
import { huespedCrearSchema, huespedModificarSchema } from './huesped.schema.js';
import { autenticar } from '../shared/autenticar.js';
import { requiereRol } from '../shared/autorizar.js';

export const huespedRouter = Router();

// Leer: Administrador y Supervisor. Crear, modificar y borrar: solo Administrador.
huespedRouter.use(autenticar);
const lectura = requiereRol('Administrador', 'Supervisor');
const escritura = requiereRol('Administrador');

huespedRouter.get('/', lectura, listar);
huespedRouter.get('/:id', lectura, obtener);
huespedRouter.post('/', escritura, validar(huespedCrearSchema), crear);
huespedRouter.patch('/:id', escritura, validar(huespedModificarSchema), modificar);
huespedRouter.delete('/:id', escritura, eliminar);
