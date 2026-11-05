// Seed: crea los tipos de usuario y el primer administrador.
// No hay registro público, así que sin esto nadie podría entrar al sistema.
// Se puede correr varias veces: upsert no duplica lo que ya existe.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// || y no ??: una variable que existe pero vacía también cae al valor por defecto
const nombreAdmin = process.env.SEED_ADMIN_NOMBRE || 'admin';
const passwordAdmin = process.env.SEED_ADMIN_PASSWORD;

// La contraseña sale del .env para no dejarla escrita en el código
if (!passwordAdmin || passwordAdmin.length < 8) {
  console.error('✖ Falta SEED_ADMIN_PASSWORD en el .env (mínimo 8 caracteres)');
  process.exit(1);
}

for (const tipo of [
  { descripcion: 'Administrador', rolBase: 'Administrador' },
  { descripcion: 'Supervisor', rolBase: 'Supervisor' },
  { descripcion: 'Limpieza', rolBase: 'Operador' },
]) {
  await prisma.tipoUsuario.upsert({
    where: { descripcion: tipo.descripcion },
    update: {},
    create: tipo,
  });
}

const tipoAdmin = await prisma.tipoUsuario.findUniqueOrThrow({ where: { descripcion: 'Administrador' } });

await prisma.usuario.upsert({
  where: { nombre: nombreAdmin },
  update: {}, // si ya existe no le pisamos la contraseña
  create: {
    nombre: nombreAdmin,
    passwordHash: await bcrypt.hash(passwordAdmin, 10),
    tipoUsuarioId: tipoAdmin.id,
  },
});

console.log(`✔ Seed listo: 3 tipos de usuario y el administrador "${nombreAdmin}"`);
await prisma.$disconnect();
