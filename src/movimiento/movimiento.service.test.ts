import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConflictError, ForbiddenError, NotFoundError } from '../shared/errors.js';

// Test unitario: el service sin base de datos y sin reloj de verdad.
// Se reemplazan por módulos falsos (guía 10, bloque 6: mock de módulo).

type FnPrisma = (args: unknown) => Promise<unknown>;
const prisma = {
  movimiento: {
    findUnique: jest.fn<FnPrisma>(),
    update: jest.fn<FnPrisma>(),
  },
};
jest.unstable_mockModule('../shared/prisma.js', () => ({ prisma }));

// El reloj también cruza el borde de la aplicación: si no se fija, el resultado
// depende de cuándo se corre el test.
jest.unstable_mockModule('../shared/fecha.js', () => ({
  ahoraArgentina: () => ({ fecha: '2026-11-10', hora: '15:20' }),
  fechaLegible: (fecha: string) => fecha,
}));

// Recién ahora se importa el service, para que reciba los módulos falsos
const service = await import('./movimiento.service.js');

// Usuarios tal como vienen en el token: sub es el id, como texto
const limpieza = { sub: '7', rol: 'Limpieza' };
const otraLimpieza = { sub: '8', rol: 'Limpieza' };
const admin = { sub: '1', rol: 'Administrador' };

// Un check-in asignado al usuario 7
const checkIn = { id: 50, tipo: 'CHECK_IN', estado: 'PENDIENTE', usuarioId: 7 };

beforeEach(() => {
  jest.clearAllMocks(); // que ningún test vea las llamadas del anterior
});

describe('marcar un movimiento como realizado', () => {
  it('deja a Limpieza marcar uno asignado a ella, con la fecha y hora de ahora', async () => {
    prisma.movimiento.findUnique.mockResolvedValue(checkIn);

    await service.marcarRealizado(checkIn.id, {}, limpieza);

    expect(prisma.movimiento.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: checkIn.id },
      data: { estado: 'REALIZADO', fechaRealizado: new Date('2026-11-10'), horaRealizado: '15:20' },
    }));
  });

  it('usa la fecha y hora que manda Limpieza si las manda', async () => {
    prisma.movimiento.findUnique.mockResolvedValue(checkIn);

    await service.marcarRealizado(checkIn.id, { fechaRealizado: '2026-11-09', horaRealizado: '18:00' }, limpieza);

    expect(prisma.movimiento.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { estado: 'REALIZADO', fechaRealizado: new Date('2026-11-09'), horaRealizado: '18:00' },
    }));
  });

  it('no deja a Limpieza marcar uno asignado a otro', async () => {
    prisma.movimiento.findUnique.mockResolvedValue(checkIn);

    await expect(service.marcarRealizado(checkIn.id, {}, otraLimpieza)).rejects.toThrow(ForbiddenError);
    expect(prisma.movimiento.update).not.toHaveBeenCalled(); // la mitad importante: no lo marcó
  });

  it('no deja a Limpieza marcar uno que no tiene a nadie asignado', async () => {
    prisma.movimiento.findUnique.mockResolvedValue({ ...checkIn, usuarioId: null });

    await expect(service.marcarRealizado(checkIn.id, {}, limpieza)).rejects.toThrow(ForbiddenError);
    expect(prisma.movimiento.update).not.toHaveBeenCalled();
  });

  it('deja a un Administrador marcar uno asignado a otro', async () => {
    prisma.movimiento.findUnique.mockResolvedValue(checkIn);

    await service.marcarRealizado(checkIn.id, {}, admin);

    expect(prisma.movimiento.update).toHaveBeenCalled();
  });

  it('no deja marcar uno cancelado, ni siquiera a su asignado', async () => {
    prisma.movimiento.findUnique.mockResolvedValue({ ...checkIn, estado: 'CANCELADO' });

    await expect(service.marcarRealizado(checkIn.id, {}, limpieza)).rejects.toThrow(ConflictError);
    expect(prisma.movimiento.update).not.toHaveBeenCalled();
  });

  it('avisa que el movimiento no existe', async () => {
    prisma.movimiento.findUnique.mockResolvedValue(null);

    await expect(service.marcarRealizado(99, {}, limpieza)).rejects.toThrow(NotFoundError);
  });
});
