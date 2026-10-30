// env va primero: si falta configuración, la app corta acá antes de levantar nada
import { env } from './config/env.js';
import { app } from './app.js';
import { prisma } from './shared/prisma.js';

// 0.0.0.0 y no localhost: en Render la API corre en un contenedor y el proxy
// de la plataforma le habla desde afuera. El puerto lo pone Render en PORT.
const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`API escuchando en el puerto ${env.PORT}`);
});

// Para publicar una versión nueva, Render manda SIGTERM al proceso viejo.
// Primero se cierra el servidor (termina los requests en curso), después la base:
// al revés, esos requests se encontrarían la conexión cerrada y contestarían 500.
process.on('SIGTERM', () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
