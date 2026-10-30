import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from './app.js';
import './config/env.js'; // carga y valida el .env (las credenciales del admin del seed salen de ahí)
import { prisma } from './shared/prisma.js';

// Test de integración: la app entera (rutas, middlewares, controllers, services y errorHandler)
// contra la base de verdad del .env. supertest le hace requests a app sin levantar el servidor.
// Todo lo que crea lleva el prefijo PRUEBA y se borra en el afterAll.

// La base de Azure se pausa sola: el primer request puede tardar hasta un minuto en despertarla
const UN_MINUTO_Y_MEDIO = 90_000;

let tokenAdmin = '';
let tokenLimpieza = '';
let tokenOtraLimpieza = '';
const ids = { inmueble: 0, reserva: 0, checkIn: 0, checkOut: 0, limpieza: 0, otraLimpieza: 0 };

// Borra lo que crea este archivo. Se llama al terminar y también al empezar:
// si una corrida anterior se cortó a la mitad (Ctrl+C), sus restos harían fallar esta
// (staysId y nombres son únicos). Directo con prisma, sin pasar por la API.
async function borrarDatosDePrueba() {
  await prisma.reserva.deleteMany({ where: { staysId: 'PRUEBA-TEST-RES' } }); // en cascada: movimientos y notificaciones
  await prisma.inmueble.deleteMany({ where: { staysId: 'PRUEBA-TEST-INM' } });
  await prisma.usuario.deleteMany({ where: { nombre: { in: ['prueba_limpieza_1', 'prueba_limpieza_2'] } } });
}

// Crea un usuario de Limpieza con contraseña al azar y devuelve su id y su token
async function crearLimpieza(nombre: string) {
  const password = `Prueba-${Math.random().toString(36).slice(2)}`;
  const tipos = await request(app).get('/api/tipos-usuario').set('Authorization', `Bearer ${tokenAdmin}`);
  const limpieza = tipos.body.find((t: { descripcion: string }) => t.descripcion === 'Limpieza');
  const creado = await request(app)
    .post('/api/usuarios')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ nombre, password, tipoUsuarioId: limpieza.id });
  const login = await request(app).post('/api/auth/login').send({ nombre, password });
  return { id: creado.body.id as number, token: login.body.token as string };
}

beforeAll(async () => {
  await borrarDatosDePrueba();

  const login = await request(app)
    .post('/api/auth/login')
    .send({ nombre: process.env.SEED_ADMIN_NOMBRE, password: process.env.SEED_ADMIN_PASSWORD });
  tokenAdmin = login.body.token;

  const limpieza = await crearLimpieza('prueba_limpieza_1');
  const otra = await crearLimpieza('prueba_limpieza_2');
  ids.limpieza = limpieza.id;
  tokenLimpieza = limpieza.token;
  ids.otraLimpieza = otra.id;
  tokenOtraLimpieza = otra.token;

  const inmueble = await request(app)
    .post('/api/inmuebles')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({ staysId: 'PRUEBA-TEST-INM', direccion: 'Calle de Prueba 100' });
  ids.inmueble = inmueble.body.id;

  // La reserva nace con su check-in y su check-out (sin asignar)
  const reserva = await request(app)
    .post('/api/reservas')
    .set('Authorization', `Bearer ${tokenAdmin}`)
    .send({
      staysId: 'PRUEBA-TEST-RES',
      fechaInicio: '2030-01-10',
      horaInicio: '15:00',
      fechaFin: '2030-01-12',
      horaFin: '10:00',
      titular: 'Titular de Prueba',
      inmuebleId: ids.inmueble,
    });
  ids.reserva = reserva.body.id;
  ids.checkIn = reserva.body.movimientos.find((m: { tipo: string }) => m.tipo === 'CHECK_IN').id;
  ids.checkOut = reserva.body.movimientos.find((m: { tipo: string }) => m.tipo === 'CHECK_OUT').id;
}, UN_MINUTO_Y_MEDIO);

afterAll(async () => {
  await borrarDatosDePrueba();
  await prisma.$disconnect(); // si no, Jest queda esperando la conexión abierta
}, UN_MINUTO_Y_MEDIO);

describe('autenticación', () => {
  it('rechaza el login con contraseña incorrecta, sin decir qué falló', async () => {
    const res = await request(app).post('/api/auth/login').send({ nombre: process.env.SEED_ADMIN_NOMBRE, password: 'incorrecta-123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciales inválidas' });
  });

  it('pide token para ver los movimientos', async () => {
    const res = await request(app).get('/api/movimientos');

    expect(res.status).toBe(401);
  });

  it('no deja a Limpieza asignar movimientos', async () => {
    const res = await request(app)
      .patch(`/api/movimientos/${ids.checkIn}/asignar`)
      .set('Authorization', `Bearer ${tokenLimpieza}`)
      .send({ usuarioId: ids.limpieza });

    expect(res.status).toBe(403);
  });
});

describe('asignar un movimiento y hacerlo', () => {
  it('el admin asigna el check-in y el operador recibe la notificación', async () => {
    const asignado = await request(app)
      .patch(`/api/movimientos/${ids.checkIn}/asignar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ usuarioId: ids.limpieza });
    const notificaciones = await request(app)
      .get('/api/notificaciones/mias?noLeidas=true')
      .set('Authorization', `Bearer ${tokenLimpieza}`);

    expect(asignado.status).toBe(200);
    expect(asignado.body.usuarioId).toBe(ids.limpieza);
    expect(notificaciones.body).toHaveLength(1);
    expect(notificaciones.body[0].mensaje).toBe(
      `Te asignaron el check-in del inmueble ${ids.inmueble} (Calle de Prueba 100) el 10/01/2030 a las 15:00`,
    );
  });

  it('el operador ve el movimiento en su agenda, con la fecha y hora de la reserva', async () => {
    const res = await request(app)
      .get('/api/movimientos/agenda?desde=2030-01-01&hasta=2030-01-31')
      .set('Authorization', `Bearer ${tokenLimpieza}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ id: ids.checkIn, tipo: 'CHECK_IN', fecha: '2030-01-10', hora: '15:00', titular: 'Titular de Prueba' }),
    ]);
  });

  it('otro operador no puede marcarlo como realizado', async () => {
    const res = await request(app)
      .patch(`/api/movimientos/${ids.checkIn}/realizado`)
      .set('Authorization', `Bearer ${tokenOtraLimpieza}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('su operador lo marca como realizado', async () => {
    const res = await request(app)
      .patch(`/api/movimientos/${ids.checkIn}/realizado`)
      .set('Authorization', `Bearer ${tokenLimpieza}`)
      .send({ fechaRealizado: '2030-01-10', horaRealizado: '15:30' });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('REALIZADO');
    expect(res.body.horaRealizado).toBe('15:30');
  });
});

describe('transacción de la asignación', () => {
  it('si algo falla a mitad de camino, no queda la notificación sin el movimiento asignado', async () => {
    // Se hace fallar a propósito el segundo paso de la transacción (actualizar el movimiento),
    // después de que el primero (crear la notificación) ya se ejecutó en la base.
    const transaccionReal = prisma.$transaction.bind(prisma);
    const espia = jest.spyOn(prisma, '$transaction').mockImplementation(((pasos: (tx: unknown) => Promise<unknown>) =>
      transaccionReal(async (tx) => {
        const txQueFalla = new Proxy(tx, {
          get: (objetivo, propiedad) =>
            propiedad === 'movimiento'
              ? { update: () => Promise.reject(new Error('falla simulada en el medio de la transacción')) }
              : Reflect.get(objetivo, propiedad),
        });
        return pasos(txQueFalla);
      })) as never);
    const silenciar = jest.spyOn(console, 'error').mockImplementation(() => {}); // el errorHandler loguea el 500

    const res = await request(app)
      .patch(`/api/movimientos/${ids.checkOut}/asignar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ usuarioId: ids.limpieza });

    espia.mockRestore();
    silenciar.mockRestore();

    // La respuesta es el error, y en la base no quedó nada a medias: ni asignado ni notificación
    const checkOut = await prisma.movimiento.findUnique({ where: { id: ids.checkOut }, include: { notificacion: true } });
    expect(res.status).toBe(500);
    expect(checkOut?.usuarioId).toBeNull();
    expect(checkOut?.notificacion).toBeNull();
  });

  it('sin la falla, la misma asignación guarda las dos cosas', async () => {
    const res = await request(app)
      .patch(`/api/movimientos/${ids.checkOut}/asignar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ usuarioId: ids.limpieza });

    const checkOut = await prisma.movimiento.findUnique({ where: { id: ids.checkOut }, include: { notificacion: true } });
    expect(res.status).toBe(200);
    expect(checkOut?.usuarioId).toBe(ids.limpieza);
    expect(checkOut?.notificacion).not.toBeNull();
  });
});
