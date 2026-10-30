import { config } from 'dotenv';
import { z } from 'zod';

config({ quiet: true }); // lee el .env y lo mete en process.env

// La configuración también viene de afuera: se valida al arrancar,
// así la API no levanta a medias y explota recién en el primer request.
const envSchema = z.object({
  DATABASE_URL: z.string().startsWith('sqlserver://', 'Tiene que ser una conexión de SQL Server'),
  JWT_SECRET: z.string().min(32, 'Al menos 32 caracteres'),
  PORT: z.coerce.number().default(3000),
  // Origen exacto del front (esquema + host + puerto, sin barra final)
  CORS_ORIGIN: z.url('Tiene que ser una URL, por ejemplo http://localhost:5173'),
  // Para la sincronización: el dominio va sin https:// (por ejemplo "miempresa.stays.com.br")
  STAYS_DOMAIN: z.string().min(1, 'Falta el dominio de Stays').regex(/^[^/:]+$/, 'Solo el dominio, sin https:// ni barras'),
  STAYS_CLIENT_ID: z.string().min(1, 'Falta el client_id de Stays'),
  STAYS_CLIENT_SECRET: z.string().min(1, 'Falta el client_secret de Stays'),
});

const resultado = envSchema.safeParse(process.env);
if (!resultado.success) {
  console.error('✖ Falta configuración o está mal:');
  for (const issue of resultado.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = resultado.data; // tipado: env.PORT es number
