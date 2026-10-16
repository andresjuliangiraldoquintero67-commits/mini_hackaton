// Lector CSV mínimo: soporta comillas ("a, b"), comillas escapadas ("") y BOM.
// Devuelve un objeto por fila con las cabeceras en minúscula.
export function leerCsvTexto(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;
  const t = texto.replace(/^﻿/, '');

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

  const noVacias = filas.filter((f) => f.some((v) => v.trim() !== ''));
  if (noVacias.length === 0) return [];
  const cabecera = noVacias[0].map((h) => h.trim().toLowerCase());
  return noVacias.slice(1).map((f) =>
    Object.fromEntries(cabecera.map((h, i) => [h, (f[i] ?? '').trim()]))
  );
}
