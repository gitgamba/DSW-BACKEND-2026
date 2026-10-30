import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from './app.js';
import './config/env.js'; // carga y valida el .env (las credenciales del admin del seed salen de ahí)
import { prisma } from './shared/prisma.js';

// Test de integración: la app entera (rutas, middlewares, controllers, services y errorHandler)
// contra la base de verdad del .env. supertest le hace requests a app sin levantar el servidor.
// Todo lo que crea lleva el prefijo PRUEBA y se borra al terminar.

// La base de Azure se pausa sola: el primer request puede tardar hasta un minuto en despertarla
const UN_MINUTO_Y_MEDIO = 90_000;

// Borra lo que crea este archivo. Se llama al terminar y también al empezar:
// si una corrida anterior se cortó a la mitad (Ctrl+C), sus restos harían fallar esta
// (staysId y nombres son únicos). Directo con prisma, sin pasar por la API.
async function borrarDatosDePrueba() {
  await prisma.reserva.deleteMany({ where: { staysId: 'PRUEBA-TEST-RES' } }); // en cascada: movimientos y notificaciones
  await prisma.inmueble.deleteMany({ where: { staysId: 'PRUEBA-TEST-INM' } });
  await prisma.usuario.deleteMany({ where: { nombre: 'prueba_limpieza' } });
}

beforeAll(borrarDatosDePrueba, UN_MINUTO_Y_MEDIO);

afterAll(async () => {
  await borrarDatosDePrueba();
  await prisma.$disconnect(); // si no, Jest queda esperando la conexión abierta
}, UN_MINUTO_Y_MEDIO);

describe('asignar un movimiento', () => {
  it('el admin asigna el check-in y el operador de Limpieza recibe la notificación', async () => {
    // 1. El admin se loguea
    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .send({ nombre: process.env.SEED_ADMIN_NOMBRE, password: process.env.SEED_ADMIN_PASSWORD });
    const admin = `Bearer ${loginAdmin.body.token}`;

    // 2. Da de alta un operador de Limpieza, que se loguea
    const tipos = await request(app).get('/api/tipos-usuario').set('Authorization', admin);
    const tipoLimpieza = tipos.body.find((t: { descripcion: string }) => t.descripcion === 'Limpieza');
    const operador = await request(app)
      .post('/api/usuarios')
      .set('Authorization', admin)
      .send({ nombre: 'prueba_limpieza', password: 'Prueba-12345', tipoUsuarioId: tipoLimpieza.id });
    const loginOperador = await request(app).post('/api/auth/login').send({ nombre: 'prueba_limpieza', password: 'Prueba-12345' });

    // 3. Carga un inmueble y una reserva, que nace con su check-in y su check-out
    const inmueble = await request(app)
      .post('/api/inmuebles')
      .set('Authorization', admin)
      .send({ staysId: 'PRUEBA-TEST-INM', direccion: 'Calle de Prueba 100' });
    const reserva = await request(app)
      .post('/api/reservas')
      .set('Authorization', admin)
      .send({
        staysId: 'PRUEBA-TEST-RES',
        fechaInicio: '2030-01-10',
        horaInicio: '15:00',
        fechaFin: '2030-01-12',
        horaFin: '10:00',
        titular: 'Titular de Prueba',
        inmuebleId: inmueble.body.id,
      });
    const checkIn = reserva.body.movimientos.find((m: { tipo: string }) => m.tipo === 'CHECK_IN');

    // 4. El operador aparece en la lista de asignables (solo id y nombre), que Limpieza no puede pedir
    const operadores = await request(app).get('/api/usuarios/operadores').set('Authorization', admin);
    const operadoresComoLimpieza = await request(app)
      .get('/api/usuarios/operadores')
      .set('Authorization', `Bearer ${loginOperador.body.token}`);

    // 5. Le asigna el check-in al operador
    const asignado = await request(app)
      .patch(`/api/movimientos/${checkIn.id}/asignar`)
      .set('Authorization', admin)
      .send({ usuarioId: operador.body.id });

    // 6. El operador ve su notificación
    const notificaciones = await request(app)
      .get('/api/notificaciones/mias?noLeidas=true')
      .set('Authorization', `Bearer ${loginOperador.body.token}`);

    expect(operadores.body).toContainEqual({ id: operador.body.id, nombre: 'prueba_limpieza' });
    expect(operadores.body.some((u: { nombre: string }) => u.nombre === process.env.SEED_ADMIN_NOMBRE)).toBe(false);
    expect(operadoresComoLimpieza.status).toBe(403);
    expect(asignado.status).toBe(200);
    expect(asignado.body.usuarioId).toBe(operador.body.id);
    expect(notificaciones.body).toHaveLength(1);
    expect(notificaciones.body[0].mensaje).toBe(
      `Te asignaron el check-in del inmueble ${inmueble.body.id} (Calle de Prueba 100) el 10/01/2030 a las 15:00`,
    );
  }, UN_MINUTO_Y_MEDIO);
});
