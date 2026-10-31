import { afterAll, expect, it, jest } from '@jest/globals';

// Ejecuta el seed dos veces con Prisma falso: no modifica Azure ni usa una contraseña real.
const nombreAnterior = process.env.SEED_ADMIN_NOMBRE;
const passwordAnterior = process.env.SEED_ADMIN_PASSWORD;
process.env.SEED_ADMIN_NOMBRE = 'seed_test';
process.env.SEED_ADMIN_PASSWORD = 'Solo-Prueba-12345';
const tipos: { id: number; descripcion: string; rolBase: string }[] = [];
const usuario = { nombre: 'seed_test', passwordHash: 'hash-existente' };
const prisma = {
  tipoUsuario: {
    upsert: jest.fn(async ({ where, create }: { where: { descripcion: string }; create: { descripcion: string; rolBase: string } }) => {
      const existente = tipos.find(tipo => tipo.descripcion === where.descripcion);
      if (existente) return existente;
      const nuevo = { id: tipos.length + 1, ...create };
      tipos.push(nuevo);
      return nuevo;
    }),
    findUniqueOrThrow: jest.fn(async () => tipos.find(tipo => tipo.descripcion === 'Administrador')),
  },
  usuario: { upsert: jest.fn(async (_args: unknown) => usuario) },
  $disconnect: jest.fn(async () => {}),
};
jest.unstable_mockModule('@prisma/client', () => ({ PrismaClient: class { constructor() { return prisma; } } }));
jest.unstable_mockModule('bcrypt', () => ({ default: { hash: async () => 'hash-de-prueba' } }));
jest.unstable_mockModule('dotenv/config', () => ({}));
afterAll(() => {
  if (nombreAnterior === undefined) delete process.env.SEED_ADMIN_NOMBRE;
  else process.env.SEED_ADMIN_NOMBRE = nombreAnterior;
  if (passwordAnterior === undefined) delete process.env.SEED_ADMIN_PASSWORD;
  else process.env.SEED_ADMIN_PASSWORD = passwordAnterior;
});

it('repetir el seed conserva los tres tipos y no actualiza la contraseña existente', async () => {
  await import('../prisma/seed.js');
  jest.resetModules(); // Sin esto, JavaScript reutilizaría la primera importación y no lo ejecutaría otra vez.
  await import('../prisma/seed.js');
  expect(tipos).toHaveLength(3);
  expect(tipos.find(tipo => tipo.descripcion === 'Limpieza')?.rolBase).toBe('Operador');
  expect(prisma.tipoUsuario.upsert).toHaveBeenCalledTimes(6);
  expect(prisma.usuario.upsert).toHaveBeenCalledTimes(2);
  expect(prisma.usuario.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  expect(usuario.passwordHash).toBe('hash-existente');
});
