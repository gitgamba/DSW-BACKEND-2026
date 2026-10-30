# DSW Backend 2026

API REST del sistema de gestión de la agenda de operadores de una empresa de hospedaje (TP de Desarrollo de Software, UTN FRRO).

Usa Node.js, Express 5, TypeScript, Zod, Prisma 6 y SQL Server (Azure SQL).

## Requisitos

- Node.js 24 (fijado en `engines` del `package.json`: Render usa esa misma versión)
- Una base SQL Server accesible por TCP. Nosotros usamos Azure SQL (free tier).

## Instalación

```bash
npm install
```

Copiá `.env.example` a `.env` y completá los valores reales. El `.env` no se sube al repo.

| Variable | Para qué |
|:-|:-|
| `DATABASE_URL` | Conexión a SQL Server (`sqlserver://servidor:1433;database=...;user=...;password=...;encrypt=true`) |
| `JWT_SECRET` | Secreto para firmar los tokens (mínimo 32 caracteres) |
| `PORT` | Puerto de la API (por defecto 3000) |
| `CORS_ORIGIN` | Origen exacto del front, con puerto y sin barra final (en desarrollo `http://localhost:5173`) |
| `STAYS_DOMAIN`, `STAYS_CLIENT_ID`, `STAYS_CLIENT_SECRET` | Acceso a la API de Stays (el dominio va sin `https://`) |
| `SEED_ADMIN_NOMBRE`, `SEED_ADMIN_PASSWORD` | Usuario y contraseña del primer administrador que crea el seed |

La configuración se valida al arrancar: si falta algo, la API no levanta y avisa qué variable está mal.

## Base de datos

Aplicar las migraciones de `prisma/migrations/` y cargar los datos iniciales:

```bash
npx prisma migrate deploy
npx prisma db seed
```

El seed crea los tipos de usuario (Administrador, Supervisor y Limpieza) y el primer administrador. Se puede correr más de una vez: no duplica nada.

### Cambios en el modelo

Usamos `migrate deploy` y no `migrate dev` porque `migrate dev` crea una *shadow database* temporal en el servidor, y en Azure eso es una base nueva que queda fuera del plan gratuito. Para agregar una migración sin shadow database, se compara la base real con el schema:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/AAAAMMDDHHMMSS_nombre/migration.sql
npx prisma migrate deploy
```

(Crear antes la carpeta `prisma/migrations/AAAAMMDDHHMMSS_nombre/` con la fecha y un nombre descriptivo.)

> La base del free tier se pausa después de una hora sin uso; la primera conexión puede tardar hasta un minuto en despertarla (por eso `connectTimeout=90` en la `DATABASE_URL`).

## Ejecución

```bash
npm run dev      # desarrollo: recarga al guardar
npm run build    # genera el cliente de Prisma y compila a dist/
npm start        # corre lo compilado
npm run check    # solo chequea tipos
npm test         # corre los tests (ver "Tests")
```

## Estructura

```
jest.config.js       configuración de los tests
render.yaml          el servicio de Render (ver "Deploy")
prisma/
  schema.prisma      modelo de datos
  seed.ts            tipos de usuario + primer admin
src/
  server.ts          valida el .env y levanta la API
  app.ts             arma Express y registra las rutas (sin levantarla: lo importan los tests)
  config/env.ts      lee y valida el .env
  shared/            lo que usan todas las features: cliente prisma, validación, errores,
                     jwt.ts (emitir/verificar), autenticar.ts y autorizar.ts (middlewares)
  types/express.d.ts agrega req.usuario al Request de Express
  auth/              login
  tipo-usuario/      routes → controller → service (+ schema Zod)
  usuario/           ídem
  inmueble/          ídem
  huesped/           ídem
  reserva/           ídem, más sincronizacion.service.ts (trae las reservas de Stays)
  movimiento/        ídem, más la agenda y la asignación de operadores
  notificacion/      avisos al operador asignado
```

Cada feature sigue el mismo recorrido: la **route** valida el body con Zod, el **controller** lee el request y arma la respuesta, y el **service** tiene la lógica y usa Prisma directamente. Todos los errores terminan en `shared/errorHandler.ts`, que responde JSON con la forma `{ error, detalle? }`.

## Tests

Usamos Jest con ts-jest y supertest, configurados como en la guía 10 de la cátedra.

```bash
npm test                  # toda la suite
npm test -- --verbose     # con el nombre de cada test
npm test -- src/usuario   # solo los de una carpeta
```

Son los que pide el TP: un test unitario por integrante y uno de integración.

| Archivo | Tipo | Qué prueba |
|:-|:-|:-|
| `src/usuario/usuario.service.test.ts` | unitario | No deja borrar al único Administrador (`409`) y no llega a llamar al `delete`. |
| `src/movimiento/movimiento.service.test.ts` | unitario | Limpieza no puede marcar como realizado un movimiento asignado a otro (`403`) y no llega a llamar al `update`. |
| `src/app.test.ts` | integración | La app entera contra la base: el admin se loguea, da de alta un operador de Limpieza (que aparece en `GET /usuarios/operadores`, donde Limpieza recibe `403`), carga un inmueble y una reserva, le asigna el check-in y el operador recibe la notificación. |

- **Unitarios:** no usan base de datos. Reemplazan `shared/prisma.ts` por un módulo falso con `jest.unstable_mockModule`, como en el bloque 6 de la guía. Tardan milisegundos y no necesitan `.env`.
- **Integración:** corre contra la base del `.env`, la misma de Azure. Crea sus propios datos (`PRUEBA-TEST-*` y el usuario `prueba_limpieza`) y los borra al terminar. Si la base estaba pausada, la primera corrida puede tardar hasta un minuto.

> El proyecto usa TypeScript 6 y no 7 porque ts-jest todavía no soporta TypeScript 7, que ya no trae la API de JavaScript que ts-jest necesita.

Salida esperada:

```
PASS src/movimiento/movimiento.service.test.ts
  marcar un movimiento como realizado
    √ no deja a Limpieza marcar uno asignado a otro

PASS src/usuario/usuario.service.test.ts
  eliminar un usuario
    √ no deja borrar al único Administrador

PASS src/app.test.ts
  asignar un movimiento
    √ el admin asigna el check-in y el operador de Limpieza recibe la notificación

Test Suites: 3 passed, 3 total
Tests:       3 passed, 3 total
```

## Deploy (Render)

La API va en Render (plan free) y la base sigue en Azure SQL. Render no recibe `dist/`: clona el repo y compila él. Todo lo del servicio está en `render.yaml`:

| | |
|:-|:-|
| Build | `npm ci && npm run build` (instala exacto lo del lock, genera el cliente de Prisma y compila) |
| Start | `npm start` (`node dist/src/server.js`) |
| Healthcheck | `GET /api/health` |

Lo que el código ya tiene para correr ahí: el puerto sale de `PORT` (lo pone Render), escucha en `0.0.0.0`, ante un `SIGTERM` cierra el servidor y después la conexión a la base, y `trust proxy` hace que `req.ip` sea la IP real de cada cliente y no la del proxy de Render.

### 1. Antes del push

```bash
npm run check
npm test
npm run build
git status
```

En `git status` **no** tiene que aparecer el `.env`. Si alguna vez se sube, borrarlo después no alcanza (queda en el historial): hay que cambiar todas las contraseñas y secretos que tenía.

### 2. Migraciones (a mano, antes del push)

Las migraciones no corren en Render: se aplican desde nuestra máquina, con el `.env` local que ya apunta a la base de Azure.

```bash
npx prisma migrate status    # muestra si hay migraciones sin aplicar
npx prisma migrate deploy    # las aplica
```

Si un cambio trae una migración nueva, primero `migrate deploy` y después el push: si no, la versión nueva arranca contra una base sin las columnas que espera. **Nunca `migrate dev` contra Azure** (ver "Cambios en el modelo"). El seed ya se corrió una vez y no hace falta repetirlo.

### 3. Crear el servicio

1. Subir el repo a GitHub (`git push`).
2. En Render: **New → Blueprint**, conectar GitHub y elegir el repo. Render lee el `render.yaml` y muestra el servicio `dsw-backend-2026`.
3. Completar las variables que pide (las que en el `render.yaml` tienen `sync: false`):

   | Variable | Valor |
   |:-|:-|
   | `DATABASE_URL` | La misma del `.env`, con `connectTimeout=90` |
   | `CORS_ORIGIN` | La URL del front en Vercel, con `https://` y sin barra final (`https://nombre.vercel.app`). Mientras no exista, `http://localhost:5173`: es obligatoria y sin ella la API no arranca |
   | `STAYS_DOMAIN`, `STAYS_CLIENT_ID`, `STAYS_CLIENT_SECRET` | Las del `.env` |

   `JWT_SECRET` lo genera Render solo y es distinto al de desarrollo: así un token firmado en una máquina no vale en producción. `PORT` no se carga. `SEED_*` tampoco, porque el seed no corre en Render.
4. **Apply**. El primer build tarda unos minutos.

Las variables se cambian después en el servicio → **Environment**. Al guardar, Render vuelve a deployar. Por ejemplo, cuando el front ya esté en Vercel, se pone su URL en `CORS_ORIGIN`. Si la API contesta pero el front ve un error de CORS, casi siempre es esa variable: tiene que ser exacta, sin barra final.

### 4. Firewall de Azure SQL

Azure SQL rechaza cualquier IP que no esté en su firewall, así que hay que agregar las de Render. Sin esto, la API arranca y el healthcheck da OK (no toca la base), pero el login responde `500` y en el log aparece un error de conexión.

1. **Dónde ver las IPs:** en Render, el servicio → botón **Connect** (arriba a la derecha) → pestaña **Outbound**. Son unos pocos rangos, propios de la región del servicio.
2. **Dónde cargarlas:** en el portal de Azure, el **servidor** SQL (no la base) → **Security → Networking** → **Firewall rules** → **Add a firewall rule**. Una regla por rango, con IP inicial e IP final. Un rango `/32` es una sola IP (inicial = final). Para otro prefijo, la calculadora de cualquier sitio de "CIDR to IP range" da las dos puntas.
3. **Save**.

> **No** abrir `0.0.0.0` – `255.255.255.255`. Con eso, cualquier máquina de internet puede intentar conectarse a la base, y lo único que la protege es la contraseña del usuario de SQL: los bots que prueban contraseñas contra el puerto 1433 están todo el tiempo. Las IPs de Render tampoco son solo nuestras (las comparten todos los servicios de esa región), pero es un rango chico y no el mundo entero. Si Render cambia sus IPs, el login empieza a dar `500`: volver a mirar la pestaña Outbound.

### 5. Verificar

```bash
curl https://dsw-backend-2026.onrender.com/api/health
```

Tiene que responder `{"estado":"ok"}`. Después, un login con el admin (`POST /api/auth/login`) prueba la base y el firewall. (La URL exacta está arriba en el panel del servicio.)

Si el deploy falla, leer el log del deploy en Render antes de volver a intentar:

| Lo que dice el log | Qué es |
|:-|:-|
| `✖ Falta configuración o está mal: ...` | Falta esa variable en Environment, o tiene un formato inválido |
| `No open ports detected` | No escucha en `PORT`/`0.0.0.0` (ya está resuelto en `server.ts`) |
| Error de conexión a la base / timeout en el login | Firewall de Azure, o la base estaba pausada (reintentar en un minuto) |

### Se duerme

El plan free de Render apaga el servicio a los **15 minutos** sin tráfico, y el primer request lo despierta en 30 a 60 segundos. Encima, la base de Azure se pausa después de una hora sin uso y tarda hasta un minuto más en despertar. El día de la defensa, entrar diez minutos antes y **hacer un login**: el healthcheck solo despierta la API, no la base.

## Autenticación

No hay registro público: el primer administrador sale del seed y es el que da de alta al resto.

1. Loguearse con nombre y contraseña:

   ```http
   POST /api/auth/login
   Content-Type: application/json

   { "nombre": "admin", "password": "..." }
   ```

   Responde `{ "token": "eyJ...", "usuario": { "id", "nombre", "tipoUsuarioId", "tipoUsuario" } }`. Si el nombre o la contraseña no coinciden, responde `401 Credenciales inválidas`, sin decir cuál de los dos falló.

2. Mandar el token en cada request protegido:

   ```http
   GET /api/usuarios
   Authorization: Bearer eyJ...
   ```

El token es un JWT firmado con `JWT_SECRET` que dura **8 horas**. Su payload es `{ sub: <id del usuario>, rol: <descripción del tipo> }`. Se puede leer sin el secret (no es secreto, es auténtico), por eso no lleva ningún dato privado. Como el servidor no guarda nada, un cambio de tipo o una baja recién se aplica cuando el token vence.

Roles: `Administrador`, `Supervisor` y `Limpieza`. El rol se decide con la descripción del tipo de usuario, por eso la API no deja renombrar ni borrar esos tres tipos (responde `409`).

Tampoco deja borrar ni pasar a otro tipo al **último administrador** (`409`), porque nadie más podría dar de alta usuarios.

## Endpoints

| Método | Ruta | Acceso | Body |
|:-|:-|:-|:-|
| GET | `/api/health` | pública | responde `{ "estado": "ok" }` (healthcheck de Render, no consulta la base) |
| POST | `/api/auth/login` | pública | `{ "nombre": "admin", "password": "..." }` |
| GET | `/api/tipos-usuario` | Administrador | |
| GET | `/api/tipos-usuario/:id` | Administrador | |
| POST | `/api/tipos-usuario` | Administrador | `{ "descripcion": "Supervisor" }` |
| PUT | `/api/tipos-usuario/:id` | Administrador | `{ "descripcion": "..." }` |
| DELETE | `/api/tipos-usuario/:id` | Administrador | |
| GET | `/api/usuarios` | Administrador | |
| GET | `/api/usuarios/operadores` | Administrador, Supervisor | `[{ id, nombre }]` de los usuarios de Limpieza y Supervisor (a quiénes se puede asignar un movimiento) |
| GET | `/api/usuarios/:id` | Administrador | |
| POST | `/api/usuarios` | Administrador | `{ "nombre": "juan", "password": "minimo8caracteres", "tipoUsuarioId": 3 }` |
| PATCH | `/api/usuarios/:id` | Administrador | cualquiera de los campos del POST |
| DELETE | `/api/usuarios/:id` | Administrador | |
| GET | `/api/inmuebles` | Administrador, Supervisor | |
| GET | `/api/inmuebles/:id` | Administrador, Supervisor | |
| POST | `/api/inmuebles` | Administrador | `{ "staysId": "...", "direccion": "San Martín 123", "precio": 50000, "capacidad": 4, "estado": "ACTIVO" }` (precio, capacidad y estado opcionales) |
| PATCH | `/api/inmuebles/:id` | Administrador | cualquiera de los campos del POST |
| DELETE | `/api/inmuebles/:id` | Administrador | |
| GET | `/api/huespedes` | Administrador, Supervisor | |
| GET | `/api/huespedes/:id` | Administrador, Supervisor | |
| POST | `/api/huespedes` | Administrador | `{ "staysId": "...", "apellido": "Pérez", "nombres": "Ana", "dni", "nacionalidad", "telefono", "email", "confirmoInicio", "confirmoFin" }` (desde dni, opcionales) |
| PATCH | `/api/huespedes/:id` | Administrador | cualquiera de los campos del POST |
| DELETE | `/api/huespedes/:id` | Administrador | |
| GET | `/api/reservas?desde&hasta&inmuebleId&usuarioId` | Administrador, Supervisor | filtros opcionales, ver abajo |
| GET | `/api/reservas/:id` | Administrador, Supervisor | trae inmueble, huéspedes y movimientos |
| POST | `/api/reservas` | Administrador | `{ "staysId": "...", "fechaInicio": "2026-11-10", "horaInicio": "15:00", "fechaFin": "2026-11-13", "horaFin": "10:00", "titular": "Ana Pérez", "inmuebleId": 1, "huespedIds": [1, 2], "costoEstadia", "moneda", "costo", "fechaCosto" }` |
| PATCH | `/api/reservas/:id` | Administrador | cualquiera de los campos del POST (`huespedIds` reemplaza la lista) |
| DELETE | `/api/reservas/:id` | Administrador | borra también sus movimientos |
| POST | `/api/reservas/sincronizar?desde&hasta` | Administrador | trae las reservas de Stays, ver abajo |
| GET | `/api/movimientos` | todos (Limpieza: solo los suyos) | |
| GET | `/api/movimientos/:id` | todos (Limpieza: solo los suyos) | |
| GET | `/api/movimientos/agenda?desde&hasta&usuarioId` | todos (Limpieza: solo los suyos) | ver abajo |
| POST | `/api/movimientos` | Administrador, Supervisor | `{ "reservaId": 1, "tipo": "CHECK_IN", "descripcion": "..." }` |
| PATCH | `/api/movimientos/:id` | Administrador, Supervisor | `{ "descripcion", "estado": "PENDIENTE" \| "CANCELADO" }` |
| PATCH | `/api/movimientos/:id/asignar` | Administrador, Supervisor | `{ "usuarioId": 3 }` (`null` lo desasigna) |
| PATCH | `/api/movimientos/:id/realizado` | todos (Limpieza: solo los suyos) | `{ "fechaRealizado": "2026-11-10", "horaRealizado": "15:20" }` (opcionales: por defecto, ahora) |
| DELETE | `/api/movimientos/:id` | Administrador, Supervisor | |
| GET | `/api/notificaciones/mias?noLeidas=true` | cualquier usuario logueado | |
| PATCH | `/api/notificaciones/:id/leida` | el dueño | |

Fechas en formato `AAAA-MM-DD` y horas en `HH:mm`.

### Reservas

- Toda reserva nueva, cargada a mano o sincronizada, nace con dos movimientos: `CHECK_IN` y `CHECK_OUT`, en estado `PENDIENTE` y sin operador asignado.
- Filtros del listado (todos opcionales y combinables): `desde`/`hasta` traen las reservas que se cruzan con ese rango, `inmuebleId` las de ese inmueble y `usuarioId` las que tienen algún movimiento asignado a ese usuario.

### Sincronización con Stays

`POST /api/reservas/sincronizar` trae de Stays las reservas con llegada entre `desde` y `hasta` (por defecto, de hoy a dentro de 30 días) y crea o actualiza, por `staysId`, sus inmuebles, huéspedes y reservas. Responde un resumen: `{ desde, hasta, reservas, canceladas, ignoradas }`.

- Las reservas sincronizadas quedan con `usuarioId` en `null`, porque no las cargó nadie de la empresa.
- De Stays se toman la dirección, el estado y la capacidad del inmueble; nombre, email, teléfono y documento del huésped; y fechas, horas, precio total y moneda de la reserva.
- `costoEstadia` está en la `moneda` de la reserva (código de 3 letras: `USD`, `ARS`, `BRL`), que puede no ser pesos. `costo` es nuestro y va en pesos.
- Lo que es nuestro no se pisa: el precio del inmueble (Stays no lo informa), `confirmoInicio`/`confirmoFin` del huésped y `costo`/`fechaCosto` de la reserva.
- Se puede correr las veces que haga falta: no duplica nada.
- Tarda: Stays se consulta de a una reserva (unos 40 segundos para 35 reservas).
- Si una reserva viene **cancelada** y ya estaba cargada, se conserva y sus movimientos pendientes pasan a `CANCELADO`. Si no estaba, no se crea.
- Los bloqueos de calendario (`blocked`, `maintenance`) se ignoran.
- Si Stays responde con error, la API responde `502`.

### Movimientos y agenda

- Cada reserva tiene como mucho un `CHECK_IN` y un `CHECK_OUT` (crear uno repetido responde `409`).
- Se asignan a usuarios de **Limpieza o Supervisor** (otro rol: `400`).
- Limpieza solo ve sus movimientos y solo puede marcarlos `REALIZADO` (uno ajeno: `403`). Si no manda fecha y hora, se guarda la de ese momento (hora de Argentina).
- `REALIZADO` solo se marca con `/realizado`. Volver a `PENDIENTE` borra la fecha y hora de realizado.
- Un movimiento `CANCELADO` queda congelado: editarlo, asignarlo o marcarlo responde `409`.
- La **agenda** devuelve una fila por movimiento: `{ id, tipo, estado, fecha, hora, titular, reservaId, inmueble: { id, direccion }, usuario, descripcion }`, ordenada por fecha y hora. La fecha y hora salen de la reserva: el inicio para el check-in y el fin para el check-out. Para FullCalendar, `start` es `fecha + "T" + hora`. Limpieza siempre recibe solo lo suyo, aunque mande otro `usuarioId`.

### Notificaciones

- Al asignar o reasignar un movimiento se crea su notificación, en la misma transacción que la asignación: *"Te asignaron el check-in del inmueble 5 (San Martín 123, Rosario) el 10/11/2026 a las 15:00"*.
- Hay una por movimiento y su dueño es el operador asignado. Al reasignar, la notificación pasa al nuevo y vuelve a quedar sin leer; el anterior deja de verla. Al desasignar, se borra.

La contraseña se guarda hasheada con bcrypt y nunca aparece en las respuestas.

Códigos de respuesta: `400` para datos inválidos, `401` sin token, con token inválido o vencido, o con credenciales incorrectas, `403` si el rol no tiene permiso, `404` si no existe, `409` para un valor único repetido, un registro que tiene datos relacionados o un cambio que rompería los roles (tipos base, último administrador), y `500` para los errores inesperados.
