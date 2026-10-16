// Validación de forma (tipos y campos). Las reglas de negocio están en los módulos de dominio.
import { datoInvalido } from './errores.js';

export function texto(valor, nombre, max = 120) {
  if (typeof valor !== 'string' || valor.trim() === '') throw datoInvalido(`Indica ${nombre}`);
  const v = valor.trim();
  if (v.length > max) throw datoInvalido(`${nombre} admite máximo ${max} caracteres`);
  return v;
}

export function entero(valor, nombre, { min = 0, max = Number.MAX_SAFE_INTEGER, porDefecto } = {}) {
  if ((valor === undefined || valor === null || valor === '') && porDefecto !== undefined) return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw datoInvalido(`${nombre} debe ser un número entero entre ${min} y ${max}`);
  return n;
}

export function opcion(valor, nombre, opciones) {
  if (!opciones.includes(valor)) throw datoInvalido(`${nombre} debe ser uno de: ${opciones.join(', ')}`);
  return valor;
}
