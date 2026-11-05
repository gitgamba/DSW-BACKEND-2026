import { describe, it, expect, jest } from '@jest/globals';
import { ConflictError } from '../shared/errors.js';

// Test unitario: el service sin base de datos. Como el service importa prisma directo,
// se reemplaza ese módulo por uno falso (guía 10, bloque 6: mock de módulo).

// Las funciones de prisma que usa el service. Cada jest.fn() anota cómo la llamaron
// y contesta lo que le digamos en el test.
type FnPrisma = (args: unknown) => Promise<unknown>;
const prisma = {
  usuario: {
    findUnique: jest.fn<FnPrisma>(),
    count: jest.fn<FnPrisma>(),
    delete: jest.fn<FnPrisma>(),
    update: jest.fn<FnPrisma>(),
  },
  tipoUsuario: { findUnique: jest.fn<FnPrisma>() },
};
jest.unstable_mockModule('../shared/prisma.js', () => ({ prisma }));

// Recién ahora se importa el service, para que reciba el prisma falso
const service = await import('./usuario.service.js');

describe('eliminar un usuario', () => {
  it('no deja borrar al único Administrador', async () => {
    const ana = { id: 7, nombre: 'ana', tipoUsuarioId: 1, tipoUsuario: { id: 1, descripcion: 'Dirección', rolBase: 'Administrador' } };
    prisma.usuario.findUnique.mockResolvedValue(ana);
    prisma.usuario.count.mockResolvedValue(1); // es el único

    await expect(service.eliminar(ana.id)).rejects.toThrow(ConflictError);
    expect(prisma.usuario.delete).not.toHaveBeenCalled(); // la mitad importante: no lo borró
    prisma.tipoUsuario.findUnique.mockResolvedValue({ id: 2, descripcion: 'Recepción', rolBase: 'Operador' });
    await expect(service.modificar(ana.id, { tipoUsuarioId: 2 })).rejects.toThrow(ConflictError);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });
});
