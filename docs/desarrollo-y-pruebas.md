# Preparar una PC para desarrollar y ejecutar las pruebas

Esta guía permite preparar el backend desde un clon nuevo y distinguir los tests que usan mocks de la integración contra SQL Server. Los ejemplos usan PowerShell en Windows y se ejecutan desde la raíz del repositorio, salvo el paso de clonado.

La [consigna del TP](https://github.com/gitgamba/DSW-303-2026/blob/main/README.md#33-entregas) pide instrucciones de instalación y ejecución, y evidencia de los tests para aprobación. La [propuesta](https://github.com/gitgamba/DSW-303-2026/blob/main/proposal.md) incluye tests unitarios y una integración de asignación/notificación. Esta guía explica cómo repetirlos; los resultados se registran después de ejecutarlos.

## 1. Comprobar las herramientas

Instalar [Git](https://git-scm.com/downloads) y [Node.js](https://nodejs.org/en/download) seleccionando la rama **24.x**, que incluye npm. La versión usada en la verificación histórica del equipo es **24.22.2**; `package.json` requiere `24.x`.

Abrir una terminal nueva y comprobar:

```powershell
git --version
node --version
npm --version
```

Los tres comandos deben existir y Node debe mostrar `v24.x.x`. npm se usa con el lockfile del repo; no hace falta instalar TypeScript, Prisma o Jest globalmente.

Si aparece otra versión de Node, revisar qué ejecutable está usando la terminal:

```powershell
Get-Command node,npm | Select-Object Name,Source
```

Si ya se usa [fnm](https://github.com/Schniz/fnm), se puede instalar la versión del equipo y ejecutar cada comando con ella sin cambiar la versión predeterminada:

```powershell
fnm install 24.22.2
fnm exec --using 24.22.2 node --version
fnm exec --using 24.22.2 npm.cmd --version
```

En ese caso, usar el mismo prefijo `fnm exec --using 24.22.2` para los demás comandos; con npm/npx en Windows se pueden usar `npm.cmd` y `npx.cmd`.

## 2. Clonar e instalar

Desde la carpeta donde se guardarán los repositorios:

```powershell
git clone https://github.com/gitgamba/DSW-BACKEND-2026.git
Set-Location DSW-BACKEND-2026
npm ci
```

`npm ci` instala las dependencias de ejecución, desarrollo y test a partir de `package-lock.json`. No usar `--omit=dev`: las herramientas de compilación y pruebas están en `devDependencies`. [Referencia de npm](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

En un clon nuevo, copiar `.env.example` a `.env` y completar los valores del equipo por un canal privado. Si `.env` ya existe, conservarlo. Las variables se describen en el [README](../README.md#instalación); no subir credenciales a Git ni incluirlas en evidencia.

La API y el test de integración validan también `STAYS_DOMAIN`, `STAYS_CLIENT_ID` y `STAYS_CLIENT_SECRET` al arrancar. Deben estar configuradas aunque estas pruebas no ejecuten una sincronización con Stays. `JWT_SECRET` necesita al menos 32 caracteres.

Después de configurar el entorno:

```powershell
npx prisma generate
npm run check
```

`prisma generate` genera el cliente local; no aplica migraciones ni modifica datos de la base.

## 3. Preparar el acceso a la base

Los unitarios usan mocks y no necesitan Azure ni `.env`. Para integración, configurar `DATABASE_URL` con la base autorizada y conservar `connectTimeout=90;poolTimeout=90`. `SEED_ADMIN_NOMBRE` y `SEED_ADMIN_PASSWORD` deben corresponder a un administrador existente y con contraseña vigente: definir esas variables no crea ni actualiza la cuenta.

Para la base compartida del equipo, comprobar que el esquema esté actualizado. Si hay dudas, `npx prisma migrate status` consulta el estado de las migraciones y requiere acceso a la base. Coordinar cualquier migración pendiente antes de aplicarla. El seed y las migraciones de [inicialización](../README.md#base-de-datos) corresponden a una base nueva; no se ejecutan de rutina por cambiar de PC. Nunca usar `prisma migrate dev` contra Azure.

Si Azure responde **40615 / Client with IP address ... is not allowed**:

1. Abrir el servidor SQL correspondiente en el portal de Azure.
2. Entrar en **Redes / Networking → Acceso público → Reglas de firewall**.
3. Agregar la IP pública que aparece en el error, con el mismo valor como IP inicial y final, y guardar. Se necesita una cuenta autorizada para administrar el servidor.
4. Esperar hasta cinco minutos y volver a intentar.

La autorización depende de la IP pública de la conexión. Dos PC en la misma red normalmente comparten esa IP; otra red o una VPN puede usar una diferente. Si cambia la IP, actualizar la regla exacta. Conservar las reglas del resto del equipo y las de Render. [Referencia de Azure](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql).

## 4. Pruebas

| Objetivo | Comando | Acceso a datos |
| --- | --- | --- |
| Comprobar tipos | `npm run check` | No conecta a SQL. |
| Unitarios, incluido seed con mocks | `npm test -- --runInBand --testPathIgnorePatterns=src/app.test.ts` | No conecta a SQL. |
| Solo integración | `npm test -- --runInBand --runTestsByPath src/app.test.ts` | Usa y modifica la base del `.env`. |
| Suite completa | `npm test -- --runInBand` | Incluye integración contra la base real. |
| Compilación | `npm run build` | Genera Prisma y compila; no aplica migraciones. |

Los tests unitarios cubren último administrador, permisos sobre movimientos, cambios de rol de un tipo y seed idempotente con Prisma falso. El detalle está en [Tests](../README.md#tests).

La integración usa supertest con `src/app.ts`; no hace falta levantar `npm run dev` ni escuchar en el puerto 3000. Crea y limpia exclusivamente `PRUEBA-TEST-RES`, `PRUEBA-TEST-INM`, `prueba_limpieza` y los tipos `PRUEBA-TEST-TIPO` / `PRUEBA-TEST-TIPO-RENOMBRADO`. No usar esos identificadores para datos propios ni ejecutar dos instancias de esa integración simultáneamente.

Antes de la integración, confirmar que la base configurada es la prevista y que se acepta crear y borrar esos fixtures. Si se interrumpe la ejecución, volver a ejecutar el mismo test una vez resuelto el problema: su preparación limpia los restos reservados. No limpiar tablas completas.

Los E2E del frontend se preparan y ejecutan desde el [otro repositorio](https://github.com/gitgamba/DSW-FRONTEND-2026/blob/main/docs/desarrollo-y-pruebas.md).

## 5. Ejecución local y despliegue

Para desarrollo, usar `npm run dev`: la API escucha en 3000 por defecto y `CORS_ORIGIN` debe coincidir con `http://localhost:5173`. Para correr lo compilado, usar `npm run build` y luego `npm start`.

El despliegue en Render, las variables y la verificación se describen en el [README](../README.md#deploy-render). Preparar otra PC para pruebas no requiere desplegar ni hacer push. El health `/api/health` comprueba que Express responde; un login válido también comprueba acceso a SQL y credenciales de la aplicación.

## Errores frecuentes

| Mensaje o síntoma | Comprobación y solución |
| --- | --- |
| `node` o `npm` no se reconoce | Instalar Node 24, abrir otra terminal y comprobar el ejecutable con `Get-Command`. |
| PowerShell bloquea `npm.ps1` | Usar `npm.cmd` y `npx.cmd` para los mismos comandos. |
| `EBADENGINE` o falta `process.loadEnvFile` al usar el E2E | Comprobar Node en esa terminal; ambos repos requieren 24.x. |
| No se encuentra Jest, ts-jest u otra dependencia | Ejecutar `npm ci` desde este repo, con las dependencias de desarrollo. |
| Prisma Client no está generado | Ejecutar `npx prisma generate` desde este repo. |
| `EPERM` al generar Prisma en Windows | Detener con Ctrl+C el backend de desarrollo que usa esa DLL y volver a generar. Identificar el proceso; no detener todos los Node. |
| Error 40615 y login con 500 | Habilitar la IP pública exacta de la conexión en el firewall de Azure. |
| Login con 401 | Comprobar nombre, contraseña y existencia del administrador de pruebas. No volver a ejecutar el seed para cambiar su contraseña. |
| Timeout de conexión | Revisar acceso a Azure y los parámetros de timeout; la base puede estar despertándose. |

## Evidencia para la entrega

Después de una ejecución real, registrar fecha, commit (`git rev-parse --short HEAD`), versiones de Node/npm, comando ejecutado, resultado y cantidad de suites/casos. Distinguir unitarios de integración y guardar la salida final o una captura sin credenciales, tokens, hashes ni cadenas de conexión.

Una lista de tests o un build exitoso no equivale a haber ejecutado la integración. El resultado histórico del README tampoco demuestra una nueva ejecución. Publicar la evidencia revisada en Markdown y enlazarla desde `docs/README.md` cuando corresponda a la entrega.
