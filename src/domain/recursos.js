import { enTransaccion } from '../db/transaccion.js';
import { conflicto, noEncontrado } from './errores.js';
import { texto, opcion } from './validacion.js';
import { ahoraLocal } from './tiempo.js';

export const ESTADOS_RECURSO = ['operativo', 'danado', 'en_reparacion'];

// Disponibilidad = operativo y sin asignación a una reserva activa en este momento
export function listarRecursos(db, ahora = ahoraLocal()) {
  return db
    .prepare(
      `SELECT r.codigo, r.tipo, r.estado, e.codigo AS espacio_codigo, e.nombre AS espacio,
              EXISTS (SELECT 1 FROM asignaciones_recurso a JOIN reservas rv ON rv.id = a.reserva_id
                      WHERE a.recurso_id = r.id AND rv.estado = 'activa' AND a.inicio <= ? AND a.fin > ?) AS en_uso
       FROM recursos r JOIN espacios e ON e.id = r.espacio_id ORDER BY r.codigo`
    )
    .all(ahora, ahora)
    .map((r) => ({ ...r, en_uso: Boolean(r.en_uso), disponible: r.estado === 'operativo' && !r.en_uso }));
}

export function cambiarEstadoRecurso(db, codigo, datos = {}) {
  const estado = opcion(datos.estado, 'El estado', ESTADOS_RECURSO);
  const motivo = texto(datos.motivo, 'el motivo', 200);
  return enTransaccion(db, () => {
    const r = db.prepare('SELECT id, codigo, estado FROM recursos WHERE codigo = ?').get(String(codigo).toUpperCase());
    if (!r) throw noEncontrado(`El equipo "${codigo}" no existe`);
    if (r.estado === estado) throw conflicto('SIN_CAMBIO', `${r.codigo} ya está en estado ${estado}`);
    db.prepare('UPDATE recursos SET estado = ? WHERE id = ?').run(estado, r.id);
    db.prepare(
      'INSERT INTO historial_recurso (recurso_id, estado_anterior, estado_nuevo, motivo, incidencia_id) VALUES (?, ?, ?, ?, ?)'
    ).run(r.id, r.estado, estado, motivo, datos.incidencia_id ?? null);
    return { codigo: r.codigo, estado_anterior: r.estado, estado };
  });
}

export function historialRecurso(db, codigo) {
  return db
    .prepare(
      `SELECT h.estado_anterior, h.estado_nuevo, h.motivo, h.incidencia_id, h.fecha
       FROM historial_recurso h JOIN recursos r ON r.id = h.recurso_id WHERE r.codigo = ? ORDER BY h.id DESC`
    )
    .all(String(codigo).toUpperCase());
}
