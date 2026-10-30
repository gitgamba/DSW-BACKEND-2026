// Arma la app de Express pero no la levanta: así los tests pueden importarla
// sin abrir un puerto. El que la levanta es server.ts.
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authRouter } from './auth/auth.routes.js';
import { tipoUsuarioRouter } from './tipo-usuario/tipo-usuario.routes.js';
import { usuarioRouter } from './usuario/usuario.routes.js';
import { inmuebleRouter } from './inmueble/inmueble.routes.js';
import { huespedRouter } from './huesped/huesped.routes.js';
import { reservaRouter } from './reserva/reserva.routes.js';
import { movimientoRouter } from './movimiento/movimiento.routes.js';
import { notificacionRouter } from './notificacion/notificacion.routes.js';
import { errorHandler } from './shared/errorHandler.js';

export const app = express();

// En Render los requests llegan a través de un proxy (guía 11): sin esto, req.ip sería
// la IP del proxy y no la del cliente.
// El 1 dice "confiá en un solo salto", así nadie puede inventarse la IP con X-Forwarded-For.
app.set('trust proxy', 1);

// CORS va primero: si una respuesta de error sale sin estos headers, el front
// ve un error de CORS en vez del error real. Solo se acepta el origen del front.
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'], // sin Authorization falla el preflight con token
  }),
);
app.use(express.json());

// Healthcheck: Render le pega seguido para saber si el proceso está vivo.
// No toca la base (si tarda, Render reinicia la API sin motivo), no pide token
// (pregunta un robot) y no cuenta nada (es pública).
app.get('/api/health', (req, res) => {
  res.json({ estado: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/tipos-usuario', tipoUsuarioRouter);
app.use('/api/usuarios', usuarioRouter);
app.use('/api/inmuebles', inmuebleRouter);
app.use('/api/huespedes', huespedRouter);
app.use('/api/reservas', reservaRouter);
app.use('/api/movimientos', movimientoRouter);
app.use('/api/notificaciones', notificacionRouter);

// Ninguna ruta coincidió: 404 en JSON en vez de la página HTML de Express
app.use((req, res) => {
  res.status(404).json({ error: `No existe la ruta ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler); // siempre el último
