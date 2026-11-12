// Fecha y hora actuales en Argentina, como las guardamos: "2026-11-10" y "15:00".
// El servidor puede estar en otra zona horaria (Render usa UTC). Argentina está siempre 3 horas
// atrás de UTC (no tiene horario de verano): se le restan 3 horas a ahora y se lee la fecha y hora
// del texto ISO, que queda "2026-11-10T15:00:00.000Z".
// Limitación conocida: si Argentina vuelve a tener horario de verano, usar timeZone 'America/Argentina/Buenos_Aires'.
const TRES_HORAS = 3 * 60 * 60 * 1000;

export function ahoraArgentina() {
  const texto = new Date(Date.now() - TRES_HORAS).toISOString();
  return { fecha: texto.slice(0, 10), hora: texto.slice(11, 16) };
}

// "2026-11-10" -> "10/11/2026", para los mensajes que lee una persona
export function fechaLegible(fecha: string) {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}
