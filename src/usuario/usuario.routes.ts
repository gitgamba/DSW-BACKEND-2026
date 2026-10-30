import { Router } from 'express';
import { listar, obtener, crear, modificar, eliminar } from './usuario.controller.js';
import { validar } from '../shared/validar.js';
import { usuarioCrearSchema, usuarioModificarSchema } from './usuario.schema.js';
import { autenticar } from '../shared/autenticar.js';
import { requiereRol } from '../shared/autorizar.js';

export const usuarioRouter = Router();

// Todo el CRUD de usuarios es solo para Administrador. Va antes que validar:
// un anónimo recibe 401 y no se entera del formato del body.
usuarioRouter.use(autenticar, requiereRol('Administrador'));

usuarioRouter.get('/', listar);
usuarioRouter.get('/:id', obtener);
usuarioRouter.post('/', validar(usuarioCrearSchema), crear);
usuarioRouter.patch('/:id', validar(usuarioModificarSchema), modificar);
usuarioRouter.delete('/:id', eliminar);
