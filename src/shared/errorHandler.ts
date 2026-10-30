import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from './errors.js';

// Último middleware de la app: todos los errores terminan acá y salen como JSON
// con la forma { error, detalle? }.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Datos que no cumplen un esquema de Zod (body o params)
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      detalle: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
    return;
  }

  // Body que ni siquiera es JSON válido (lo detecta express.json())
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El body no es un JSON válido' });
    return;
  }

  // Restricciones de la base que conviene explicar en vez de devolver 500
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Ya existe un registro con ese valor único' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'No se puede completar: el registro tiene otros datos relacionados' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro no encontrado' });
      return;
    }
  }

  // Cualquier otra cosa es un error nuestro: se loguea y no se le muestra el detalle al cliente
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
};
