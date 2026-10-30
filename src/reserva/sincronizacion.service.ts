import { prisma } from '../shared/prisma.js';
import { env } from '../config/env.js';
import { AppError, ValidationError } from '../shared/errors.js';
import { MOVIMIENTOS_INICIALES } from './reserva.service.js';
import type { SincronizarInput } from './reserva.schema.js';

// Solo los campos de Stays que usamos (doc: https://stays.net/external-api/)
interface ReservaStays {
  _id: string;
  type: string; // reserved | booked | contract | blocked | maintenance | canceled
  checkInDate: string; // AAAA-MM-DD
  checkInTime: string; // HH:mm
  checkOutDate: string;
  checkOutTime: string;
  _idlisting: string;
  _idclient: string;
  price?: { currency?: string; _f_total?: number };
}

interface ClienteStays {
  _id: string;
  fName?: string;
  lName?: string;
  email?: string;
  phones?: { iso: string }[]; // iso: el número completo, con código de país
  documents?: { numb: string }[];
}

interface ListingStays {
  _id: string;
  internalName?: string;
  status?: string; // active | inactive | hidden | draft
  _i_maxGuests?: number;
  address?: { street?: string; streetNumber?: string; city?: string };
}

// Las reservas que son huéspedes de verdad (blocked y maintenance son bloqueos del calendario)
const TIPOS_CON_HUESPED = ['reserved', 'booked', 'contract'];
// Stays solo devuelve las canceladas si se las pide explícitamente con type=canceled
const FILTRO_TIPOS = [...TIPOS_CON_HUESPED, 'canceled'].map((tipo) => `&type=${tipo}`).join('');
const LIMITE_POR_PAGINA = 20; // el máximo que deja Stays

// GET a la API de Stays con autenticación Basic: base64("client_id:client_secret")
async function getStays(ruta: string) {
  const credenciales = Buffer.from(`${env.STAYS_CLIENT_ID}:${env.STAYS_CLIENT_SECRET}`).toString('base64');
  const respuesta = await fetch(`https://${env.STAYS_DOMAIN}/external/v1${ruta}`, {
    headers: { Authorization: `Basic ${credenciales}` },
  });
  if (!respuesta.ok) {
    // 502: el que falló es el servicio externo, no el pedido del cliente
    throw new AppError(502, `Stays respondió ${respuesta.status} en ${ruta.split('?')[0]}`);
  }
  return respuesta.json();
}

export async function sincronizar(rango: SincronizarInput) {
  const desde = rango.desde ?? sumarDias(0);
  const hasta = rango.hasta ?? sumarDias(30);
  if (hasta < desde) {
    throw new ValidationError('"hasta" no puede ser anterior a "desde"');
  }

  const resumen = { reservas: 0, canceladas: 0, ignoradas: 0 };
  // Varias reservas comparten inmueble o cliente: se guarda el id local para no pedirlos dos veces
  const inmuebles = new Map<string, number>();
  const huespedes = new Map<string, number>();

  // Stays devuelve de a 20: se pide la página siguiente hasta que venga una incompleta
  for (let skip = 0; ; skip += LIMITE_POR_PAGINA) {
    const pagina: ReservaStays[] = await getStays(
      `/booking/reservations?from=${desde}&to=${hasta}&dateType=arrival&skip=${skip}&limit=${LIMITE_POR_PAGINA}${FILTRO_TIPOS}`,
    );

    for (const r of pagina) {
      if (r.type === 'canceled') {
        // Si ya la teníamos, se conserva pero sus movimientos pendientes se cancelan.
        // Si no la teníamos, no se crea (updateMany no encuentra nada).
        await prisma.movimiento.updateMany({
          where: { reserva: { staysId: r._id }, estado: 'PENDIENTE' },
          data: { estado: 'CANCELADO' },
        });
        resumen.canceladas++;
        continue;
      }
      if (!TIPOS_CON_HUESPED.includes(r.type)) {
        resumen.ignoradas++; // por si Stays agrega un tipo nuevo
        continue;
      }

      const inmuebleId = inmuebles.get(r._idlisting) ?? (await sincronizarInmueble(r._idlisting));
      inmuebles.set(r._idlisting, inmuebleId);
      const huespedId = huespedes.get(r._idclient) ?? (await sincronizarHuesped(r._idclient));
      huespedes.set(r._idclient, huespedId);

      await sincronizarReserva(r, inmuebleId, huespedId);
      resumen.reservas++;
    }

    if (pagina.length < LIMITE_POR_PAGINA) {
      break;
    }
  }

  return { desde, hasta, ...resumen };
}

// upsert: si ya existe ese staysId lo actualiza, si no lo crea
async function sincronizarInmueble(staysId: string) {
  const listing: ListingStays = await getStays(`/content/listings/${staysId}`);
  const datos = {
    direccion: armarDireccion(listing),
    estado: listing.status === 'active' ? 'ACTIVO' : 'INACTIVO',
    capacidad: listing._i_maxGuests ?? null,
  };
  // El precio no viene de Stays: no se toca, lo carga el admin
  const inmueble = await prisma.inmueble.upsert({
    where: { staysId },
    create: { staysId, ...datos },
    update: datos,
  });
  return inmueble.id;
}

async function sincronizarHuesped(staysId: string) {
  const cliente: ClienteStays = await getStays(`/booking/clients/${staysId}`);
  const datos = {
    // Se recorta al largo de cada columna: un texto más largo haría fallar el insert
    // y cortaría toda la sincronización por un solo huésped.
    apellido: (cliente.lName || '-').slice(0, 100),
    nombres: (cliente.fName || '-').slice(0, 100),
    // Un email recortado ya no sirve: si no entra, mejor no guardarlo
    email: cliente.email && cliente.email.length <= 100 ? cliente.email : null,
    telefono: cliente.phones?.[0]?.iso?.slice(0, 30) ?? null,
    dni: cliente.documents?.[0]?.numb?.slice(0, 20) ?? null,
  };
  // confirmoInicio/confirmoFin son nuestros: el update no los pisa
  const huesped = await prisma.huesped.upsert({
    where: { staysId },
    create: { staysId, ...datos },
    update: datos,
  });
  return huesped.id;
}

async function sincronizarReserva(r: ReservaStays, inmuebleId: number, huespedId: number) {
  const huesped = await prisma.huesped.findUniqueOrThrow({ where: { id: huespedId } });
  const datos = {
    fechaInicio: new Date(r.checkInDate),
    horaInicio: r.checkInTime,
    fechaFin: new Date(r.checkOutDate),
    horaFin: r.checkOutTime,
    titular: `${huesped.nombres} ${huesped.apellido}`.slice(0, 100), // la columna es de 100
    costoEstadia: r.price?._f_total ?? null,
    moneda: r.price?.currency ?? null, // USD, ARS, BRL...
    inmuebleId,
  };
  // costo y fechaCosto son nuestros: el update no los pisa
  await prisma.reserva.upsert({
    where: { staysId: r._id },
    create: {
      staysId: r._id,
      ...datos,
      usuarioId: null, // vino de Stays, no la cargó nadie
      huespedes: { connect: { id: huespedId } },
      movimientos: { create: MOVIMIENTOS_INICIALES },
    },
    update: { ...datos, huespedes: { connect: { id: huespedId } } },
  });
}

function armarDireccion(listing: ListingStays) {
  const a = listing.address;
  const calle = [a?.street, a?.streetNumber].filter(Boolean).join(' ');
  const direccion = [calle, a?.city].filter(Boolean).join(', ');
  return (direccion || listing.internalName || listing._id).slice(0, 200); // la columna es de 200
}

// Fecha de hoy + n días como AAAA-MM-DD (en UTC: en Argentina, después de las 21 ya es "mañana")
function sumarDias(dias: number) {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
