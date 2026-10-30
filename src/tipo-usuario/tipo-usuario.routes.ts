import { Router } from 'express';
import { listar, obtener, crear, modificar, eliminar } from './tipo-usuario.controller.js';
import { validar } from '../shared/validar.js';
import { tipoUsuarioSchema } from './tipo-usuario.schema.js';
import { autenticar } from '../shared/autenticar.js';
import { requiereRol } from '../shared/autorizar.js';

export const tipoUsuarioRouter = Router();

// Solo el Administrador gestiona los tipos de usuario (antes que validar: 401/403 primero)
tipoUsuarioRouter.use(autenticar, requiereRol('Administrador'));

tipoUsuarioRouter.get('/', listar);
tipoUsuarioRouter.get('/:id', obtener);
tipoUsuarioRouter.post('/', validar(tipoUsuarioSchema), crear);
tipoUsuarioRouter.put('/:id', validar(tipoUsuarioSchema), modificar);
tipoUsuarioRouter.delete('/:id', eliminar);
