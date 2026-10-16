// Fechas locales del campus en formato 'YYYY-MM-DDTHH:MM' (America/Bogota, sin cambio de horario).
// Para sumar minutos se tratan como UTC solo de forma interna: no hay conversión de zona.

export const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const aDate = (s) => new Date(`${s}:00Z`);
const aTexto = (d) => d.toISOString().slice(0, 16);

export const esFechaValida = (s) => FORMATO_FECHA.test(s) && !Number.isNaN(aDate(s).getTime()) && aTexto(aDate(s)) === s;
export const sumarMinutos = (s, min) => aTexto(new Date(aDate(s).getTime() + min * 60000));
export const minutosEntre = (a, b) => (aDate(b) - aDate(a)) / 60000;
export const hora = (s) => s.slice(11, 16);
export const dia = (s) => s.slice(0, 10);

// Hora actual del campus en el mismo formato (Colombia es UTC-5 todo el año)
export const ahoraLocal = (d = new Date()) => aTexto(new Date(d.getTime() - 5 * 60 * 60000));
