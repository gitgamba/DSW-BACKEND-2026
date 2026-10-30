import { Router } from 'express';
import { listar, listarOperadores, obtener, crear, modificar, eliminar } from './usuario.controller.js';
import { validar } from '../shared/validar.js';
import { usuarioCrearSchema, usuarioModificarSchema } from './usuario.schema.js';
import { autenticar } from '../shared/autenticar.js';
import { requiereRol } from '../shared/autorizar.js';

export const usuarioRouter = Router();

// La única ruta que también usa el Supervisor (para asignar movimientos). Va antes del use de abajo:
// Express prueba las rutas en orden, y esta responde sin llegar al requiereRol('Administrador').
usuarioRouter.get('/operadores', autenticar, requiereRol('Administrador', 'Supervisor'), listarOperadores);

// Todo el CRUD de usuarios es solo para Administrador. Va antes que validar:
// un anónimo recibe 401 y no se entera del formato del body.
usuarioRouter.use(autenticar, requiereRol('Administrador'));

usuarioRouter.get('/', listar);
usuarioRouter.get('/:id', obtener);
usuarioRouter.post('/', validar(usuarioCrearSchema), crear);
usuarioRouter.patch('/:id', validar(usuarioModificarSchema), modificar);
usuarioRouter.delete('/:id', eliminar);
