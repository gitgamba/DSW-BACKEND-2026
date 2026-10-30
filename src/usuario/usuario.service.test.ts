import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConflictError, NotFoundError } from '../shared/errors.js';

// Test unitario: el service sin base de datos. Como el service importa prisma directo,
// se reemplaza ese módulo por uno falso (guía 10, bloque 6: mock de módulo).

// Las funciones de prisma que usa el service. Cada jest.fn() anota cómo la llamaron
// y contesta lo que le digamos en cada test.
type FnPrisma = (args: unknown) => Promise<unknown>;
const prisma = {
  usuario: {
    findUnique: jest.fn<FnPrisma>(),
    count: jest.fn<FnPrisma>(),
    update: jest.fn<FnPrisma>(),
    delete: jest.fn<FnPrisma>(),
  },
  tipoUsuario: {
    findUnique: jest.fn<FnPrisma>(),
  },
};
jest.unstable_mockModule('../shared/prisma.js', () => ({ prisma }));

// Recién ahora se importa el service, para que reciba el prisma falso
const service = await import('./usuario.service.js');

// Datos de ejemplo
const ADMINISTRADOR = { id: 1, descripcion: 'Administrador' };
const LIMPIEZA = { id: 3, descripcion: 'Limpieza' };
const ana = { id: 7, nombre: 'ana', tipoUsuarioId: 1, tipoUsuario: ADMINISTRADOR };
const pepe = { id: 8, nombre: 'pepe', tipoUsuarioId: 3, tipoUsuario: LIMPIEZA };

beforeEach(() => {
  jest.clearAllMocks(); // que ningún test vea las llamadas del anterior
});

describe('eliminar un usuario', () => {
  it('no deja borrar al único Administrador', async () => {
    prisma.usuario.findUnique.mockResolvedValue(ana);
    prisma.usuario.count.mockResolvedValue(1);

    await expect(service.eliminar(ana.id)).rejects.toThrow(ConflictError);
    expect(prisma.usuario.delete).not.toHaveBeenCalled(); // la mitad importante: no lo borró
  });

  it('deja borrar a un Administrador si hay otro', async () => {
    prisma.usuario.findUnique.mockResolvedValue(ana);
    prisma.usuario.count.mockResolvedValue(2);

    await service.eliminar(ana.id);

    expect(prisma.usuario.delete).toHaveBeenCalledWith({ where: { id: ana.id } });
  });

  it('deja borrar a alguien que no es Administrador sin contar administradores', async () => {
    prisma.usuario.findUnique.mockResolvedValue(pepe);

    await service.eliminar(pepe.id);

    expect(prisma.usuario.count).not.toHaveBeenCalled();
    expect(prisma.usuario.delete).toHaveBeenCalledWith({ where: { id: pepe.id } });
  });

  it('avisa que el usuario no existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(service.eliminar(99)).rejects.toThrow(NotFoundError);
    expect(prisma.usuario.delete).not.toHaveBeenCalled();
  });
});

describe('cambiar el tipo de un usuario', () => {
  it('no deja pasar al único Administrador a otro tipo', async () => {
    prisma.tipoUsuario.findUnique.mockResolvedValue(LIMPIEZA); // el tipo nuevo
    prisma.usuario.findUnique.mockResolvedValue(ana);
    prisma.usuario.count.mockResolvedValue(1);

    await expect(service.modificar(ana.id, { tipoUsuarioId: LIMPIEZA.id })).rejects.toThrow(ConflictError);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('deja pasar a un Administrador a otro tipo si hay otro', async () => {
    prisma.tipoUsuario.findUnique.mockResolvedValue(LIMPIEZA);
    prisma.usuario.findUnique.mockResolvedValue(ana);
    prisma.usuario.count.mockResolvedValue(2);

    await service.modificar(ana.id, { tipoUsuarioId: LIMPIEZA.id });

    expect(prisma.usuario.update).toHaveBeenCalled();
  });

  it('deja al único Administrador cambiarse el nombre (no le cambia el tipo)', async () => {
    await service.modificar(ana.id, { nombre: 'ana.admin' });

    expect(prisma.usuario.count).not.toHaveBeenCalled();
    expect(prisma.usuario.update).toHaveBeenCalled();
  });
});
