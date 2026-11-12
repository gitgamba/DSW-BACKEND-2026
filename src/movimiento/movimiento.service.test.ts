import { describe, it, expect, jest } from '@jest/globals';
import { ForbiddenError } from '../shared/errors.js';
import { agendaSchema } from './movimiento.schema.js';

// Test unitario: el service sin base de datos.
// Se reemplaza prisma por un módulo falso (guía 10, bloque 6: mock de módulo).

type FnPrisma = (args: unknown) => Promise<unknown>;
const prisma = {
  movimiento: {
    findMany: jest.fn<FnPrisma>(),
    findUnique: jest.fn<FnPrisma>(),
    update: jest.fn<FnPrisma>(),
  },
};
jest.unstable_mockModule('../shared/prisma.js', () => ({ prisma }));

// Recién ahora se importa el service, para que reciba el prisma falso
const service = await import('./movimiento.service.js');

describe('marcar un movimiento como realizado', () => {
  it('no deja a Operador marcar uno asignado a otro', async () => {
    // Un check-in asignado al usuario 7, y quien pide es el usuario 8 (sub es el id, como texto en el token)
    prisma.movimiento.findUnique.mockResolvedValue({ id: 50, tipo: 'CHECK_IN', estado: 'PENDIENTE', usuarioId: 7 });
    const otroOperador = { sub: '8', rol: 'Operador' as const };

    await expect(service.obtener(50, otroOperador)).rejects.toThrow(ForbiddenError);
    await expect(service.marcarRealizado(50, {}, otroOperador)).rejects.toThrow(ForbiddenError);
    expect(prisma.movimiento.update).not.toHaveBeenCalled(); // la mitad importante: no lo marcó
  });
});

describe('agenda con el filtro sinAsignar', () => {
  const admin = { sub: '1', rol: 'Administrador' as const };
  const operador = { sub: '8', rol: 'Operador' as const };

  // Devuelve el where con el que el service consultó a la base
  async function whereDeLaConsulta(query: object, quien: typeof admin | typeof operador) {
    prisma.movimiento.findMany.mockClear();
    prisma.movimiento.findMany.mockResolvedValue([]);
    await service.agenda(agendaSchema.parse(query), quien);
    return prisma.movimiento.findMany.mock.calls[0]![0] as { where: { usuarioId?: number | null; estado?: string } };
  }

  it('pide a la base solo los pendientes sin operador', async () => {
    const { where } = await whereDeLaConsulta({ sinAsignar: 'true' }, admin);
    expect(where.usuarioId).toBeNull();
    expect(where.estado).toBe('PENDIENTE');
  });

  it('sin el filtro no restringe operador ni estado', async () => {
    const { where } = await whereDeLaConsulta({}, admin);
    expect(where.usuarioId).toBeUndefined();
    expect(where.estado).toBeUndefined();
  });

  it('un Operador sigue viendo solo lo suyo aunque mande el filtro', async () => {
    const { where } = await whereDeLaConsulta({ sinAsignar: 'true' }, operador);
    expect(where.usuarioId).toBe(8);
    expect(where.estado).toBeUndefined();
  });

  it('rechaza un valor distinto de true', () => {
    expect(agendaSchema.safeParse({ sinAsignar: 'false' }).success).toBe(false);
    expect(agendaSchema.safeParse({ sinAsignar: 'cualquiera' }).success).toBe(false);
  });
});
