import { conflicto, noEncontrado } from './errores.js';
import { opcion } from './validacion.js';
import { ahoraLocal } from './tiempo.js';

export function listarEspacios(db, ahora = ahoraLocal()) {
  const espacios = db
    .prepare(
      `SELECT e.*, (SELECT organizacion || ' hasta ' || substr(fin, 12, 5) FROM reservas
                    WHERE espacio_id = e.id AND estado = 'activa' AND inicio <= ? AND fin > ?) AS ocupado_por
       FROM espacios e ORDER BY e.codigo`
    )
    .all(ahora, ahora);
  const recursos = db.prepare('SELECT codigo, tipo, estado, espacio_id FROM recursos ORDER BY codigo').all();
  return espacios.map((e) => ({
    ...e,
    recursos: recursos.filter((r) => r.espacio_id === e.id).map(({ espacio_id, ...r }) => r),
  }));
}

export function cambiarEstadoEspacio(db, codigo, datos = {}) {
  const estado = opcion(datos.estado, 'El estado', ['habilitado', 'inhabilitado', 'mantenimiento']);
  const e = db.prepare('SELECT id, codigo, nombre, estado FROM espacios WHERE codigo = ?').get(String(codigo).toUpperCase());
  if (!e) throw noEncontrado(`El espacio "${codigo}" no existe`);
  if (e.estado === estado) throw conflicto('SIN_CAMBIO', `${e.nombre} ya está ${estado}`);
  db.prepare('UPDATE espacios SET estado = ? WHERE id = ?').run(estado, e.id);
  return { codigo: e.codigo, nombre: e.nombre, estado };
}

export function listarErroresImportacion(db) {
  return db.prepare('SELECT archivo, fila, motivo, payload FROM import_errores ORDER BY archivo, fila').all();
}
