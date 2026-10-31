import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictError } from '../shared/errors.js';

type FnPrisma = (args: unknown) => Promise<unknown>;
const prisma = {
  tipoUsuario: { findUnique: jest.fn<FnPrisma>(), update: jest.fn<FnPrisma>() },
  usuario: { count: jest.fn<FnPrisma>() },
};
jest.unstable_mockModule('../shared/prisma.js', () => ({ prisma }));
const service = await import('./tipo-usuario.service.js');
beforeEach(() => { jest.resetAllMocks(); });

describe('rol base de un tipo de usuario', () => {
  it('permite renombrar el puesto sin cambiar su permiso', async () => {
    prisma.tipoUsuario.findUnique.mockResolvedValue({ id: 1, descripcion: 'Dirección', rolBase: 'Administrador' });
    await service.modificar(1, { descripcion: 'Gerencia', rolBase: 'Administrador' });
    expect(prisma.tipoUsuario.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { descripcion: 'Gerencia', rolBase: 'Administrador' } });
    expect(prisma.usuario.count).not.toHaveBeenCalled();
  });
  it('no permite degradar al tipo de los últimos administradores', async () => {
    prisma.tipoUsuario.findUnique.mockResolvedValue({ id: 1, rolBase: 'Administrador' });
    prisma.usuario.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    await expect(service.modificar(1, { descripcion: 'Dirección', rolBase: 'Supervisor' })).rejects.toThrow(ConflictError);
    expect(prisma.tipoUsuario.update).not.toHaveBeenCalled();
  });
  it('permite cambiar el rol si quedan administradores de otro tipo', async () => {
    prisma.tipoUsuario.findUnique.mockResolvedValue({ id: 1, rolBase: 'Administrador' });
    prisma.usuario.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    await service.modificar(1, { descripcion: 'Dirección', rolBase: 'Supervisor' });
    expect(prisma.tipoUsuario.update).toHaveBeenCalled();
  });
});
