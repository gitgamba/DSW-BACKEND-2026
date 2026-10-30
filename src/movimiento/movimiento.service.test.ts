import { describe, it, expect, jest } from '@jest/globals';
import { ForbiddenError } from '../shared/errors.js';

// Test unitario: el service sin base de datos.
// Se reemplaza prisma por un módulo falso (guía 10, bloque 6: mock de módulo).

type FnPrisma = (args: unknown) => Promise<unknown>;
const prisma = {
  movimiento: {
    findUnique: jest.fn<FnPrisma>(),
    update: jest.fn<FnPrisma>(),
  },
};
jest.unstable_mockModule('../shared/prisma.js', () => ({ prisma }));

// Recién ahora se importa el service, para que reciba el prisma falso
const service = await import('./movimiento.service.js');

describe('marcar un movimiento como realizado', () => {
  it('no deja a Limpieza marcar uno asignado a otro', async () => {
    // Un check-in asignado al usuario 7, y quien pide es el usuario 8 (sub es el id, como texto en el token)
    prisma.movimiento.findUnique.mockResolvedValue({ id: 50, tipo: 'CHECK_IN', estado: 'PENDIENTE', usuarioId: 7 });
    const otraLimpieza = { sub: '8', rol: 'Limpieza' };

    await expect(service.marcarRealizado(50, {}, otraLimpieza)).rejects.toThrow(ForbiddenError);
    expect(prisma.movimiento.update).not.toHaveBeenCalled(); // la mitad importante: no lo marcó
  });
});
