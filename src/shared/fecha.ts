// Fecha y hora actuales en Argentina, como las guardamos: "2026-11-10" y "15:00".
// El servidor puede estar en otra zona horaria (Azure usa UTC), por eso se pide la de Buenos Aires.
// 'sv-SE' es un truco conocido: ese formato regional ya escribe "2026-11-10 15:00:00".
export function ahoraArgentina() {
  const texto = new Date().toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  return { fecha: texto.slice(0, 10), hora: texto.slice(11, 16) };
}

// "2026-11-10" -> "10/11/2026", para los mensajes que lee una persona
export function fechaLegible(fecha: string) {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}
