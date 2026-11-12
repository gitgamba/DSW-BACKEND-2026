import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ quiet: true });
const prisma = new PrismaClient();
try {
  const columnas = await prisma.$queryRaw`SELECT COL_LENGTH('dbo.TipoUsuario', 'rolBase') AS longitud`;
  if (columnas[0].longitud !== null) {
    const tipos = await prisma.$queryRaw`SELECT id, descripcion, rolBase FROM dbo.TipoUsuario ORDER BY id`;
    console.log(JSON.stringify({ migracionYaAplicada: true, tipos }, null, 2));
    if (tipos.some(tipo => !['Administrador', 'Supervisor', 'Operador'].includes(tipo.rolBase))) process.exitCode = 1;
  } else {
    const tipos = await prisma.$queryRaw`SELECT id, descripcion FROM dbo.TipoUsuario ORDER BY id`;
    const conocidos = ['Administrador', 'Supervisor', 'Limpieza'];
    console.log(JSON.stringify({ tipos }, null, 2));
    if (tipos.some(tipo => !conocidos.includes(tipo.descripcion))) {
      console.error('Detener la migración: acordar el rol de los tipos desconocidos.');
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error('No se pudo comprobar la base. Revisar conexión y configuración sin publicar credenciales.');
  if (/40615/.test(error.message)) {
    const ip = error.message.match(/Client with IP address ['"]([0-9.]+)['"]/i)?.[1];
    console.error('Azure SQL bloquea la IP del cliente (40615): ' + (ip ?? 'consultar firewall'));
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
