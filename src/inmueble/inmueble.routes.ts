import { Router } from 'express';
import { listar, obtener, crear, modificar, eliminar } from './inmueble.controller.js';
import { validar } from '../shared/validar.js';
import { inmuebleCrearSchema, inmuebleModificarSchema } from './inmueble.schema.js';
import { autenticar } from '../shared/autenticar.js';
import { requiereRol } from '../shared/autorizar.js';

export const inmuebleRouter = Router();

// Leer: Administrador y Supervisor. Crear, modificar y borrar: solo Administrador.
inmuebleRouter.use(autenticar);
const lectura = requiereRol('Administrador', 'Supervisor');
const escritura = requiereRol('Administrador');

inmuebleRouter.get('/', lectura, listar);
inmuebleRouter.get('/:id', lectura, obtener);
inmuebleRouter.post('/', escritura, validar(inmuebleCrearSchema), crear);
inmuebleRouter.patch('/:id', escritura, validar(inmuebleModificarSchema), modificar);
inmuebleRouter.delete('/:id', escritura, eliminar);
