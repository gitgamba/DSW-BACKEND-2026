import { PrismaClient } from '@prisma/client';

// Un único cliente para toda la app: cada PrismaClient abre su propio pool de conexiones.
export const prisma = new PrismaClient({
  // El hash nunca sale en las consultas. El login, cuando exista, lo pide a propósito
  // con omit: { passwordHash: false }.
  omit: { usuario: { passwordHash: true } },
});
