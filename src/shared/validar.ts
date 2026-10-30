import type { Request, Response, NextFunction } from 'express';
import { z, type ZodType } from 'zod';

// Mensajes de error de Zod en castellano para toda la app (es una configuración global)
z.config(z.locales.es());

// El :id de las rutas llega como string: se convierte y se valida igual que un body.
// Uso: idSchema.parse(req.params).id
export const idSchema = z.object({
  id: z.coerce
    .number({ error: 'El id tiene que ser un número' })
    .int('El id tiene que ser un entero positivo')
    .positive('El id tiene que ser un entero positivo'),
});

// Fechas y horas viajan como texto: "2026-11-10" y "15:00"
export const fechaSchema = z.iso.date('Tiene que ser una fecha AAAA-MM-DD');
export const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Tiene que ser una hora HH:mm');

// Recibe un esquema y devuelve un middleware que valida el body antes del controller.
// Si el body no cumple, parse lanza un ZodError y el errorHandler responde 400.
export function validar(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body); // body limpio y validado para el controller
    next();
  };
}
