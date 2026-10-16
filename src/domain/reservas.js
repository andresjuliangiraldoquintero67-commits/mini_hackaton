import { REGLAS } from '../config/reglas.js';
import { enTransaccion } from '../db/transaccion.js';
import { datoInvalido, noEncontrado, conflicto, reglaIncumplida } from './errores.js';
import { esFechaValida, sumarMinutos, minutosEntre, hora, dia } from './tiempo.js';
import { texto, entero, opcion } from './validacion.js';

function fecha(valor, nombre) {
  if (typeof valor !== 'string' || !esFechaValida(valor)) {
    throw datoInvalido(`${nombre} inválida (formato AAAA-MM-DDTHH:MM)`);
  }
  return valor;
}

// Forma de los datos (400). Las reglas de negocio vienen después (409 / 422).
function validarEntrada(datos = {}) {
  const d = {
    espacio_codigo: texto(datos.espacio_codigo, 'el espacio'),
    tipo_solicitante: opcion(datos.tipo_solicitante, 'El tipo de solicitante', ['campus', 'empresa']),
    organizacion: texto(datos.organizacion, 'la organización'),
    responsable: texto(datos.responsable, 'el responsable'),
    asistentes: entero(datos.asistentes, 'Los asistentes', { min: 1, max: 10000 }),
    inicio: fecha(datos.inicio, 'Fecha de inicio'),
    fin: fecha(datos.fin, 'Fecha de fin'),
    equipos_a_transmitir: entero(datos.equipos_a_transmitir, 'Los equipos a transmitir', { min: 0, max: 10, porDefecto: 0 }),
  };
  if (d.fin <= d.inicio) throw datoInvalido('La hora de fin debe ser posterior a la de inicio');
  return d;
}

// R5: horario de operación y duración máxima
function validarHorario(d, reglas) {
  const { apertura, cierre } = reglas.HORARIO;
  if (dia(d.inicio) !== dia(d.fin) || hora(d.inicio) < apertura || hora(d.fin) > cierre) {
    throw reglaIncumplida('FUERA_DE_HORARIO', `Las reservas deben estar entre ${apertura} y ${cierre} del mismo día`);
  }
  if (minutosEntre(d.inicio, d.fin) > reglas.DURACION_MAX_RESERVA_MIN) {
    throw reglaIncumplida('DURACION_EXCEDIDA', `Una reserva puede durar máximo ${reglas.DURACION_MAX_RESERVA_MIN} minutos`);
  }
}

// R2 (estado y aforo máximo) y R4 (mínimo de asistentes)
function validarEspacioYAforo(espacio, d, reglas) {
  if (espacio.estado !== 'habilitado') {
    throw reglaIncumplida('ESPACIO_NO_HABILITADO', `${espacio.nombre} no está disponible (estado: ${espacio.estado})`);
  }
  const maximo = Math.floor((espacio.aforo * reglas.PORCENTAJE_AFORO_MAX) / 100);
  if (d.asistentes > maximo) {
    throw reglaIncumplida('AFORO_EXCEDIDO', `${espacio.nombre} admite máximo ${maximo} personas`);
  }
  if (d.asistentes < reglas.MIN_ASISTENTES_GENERAL) {
    throw reglaIncumplida('ASISTENTES_INSUFICIENTES', `Una reserva requiere mínimo ${reglas.MIN_ASISTENTES_GENERAL} personas`);
  }
}

// R1: sin solapamiento en el mismo espacio, sin importar quién reserve
function validarSolapamiento(db, espacio, d, reglas) {
  const m = reglas.MARGEN_ENTRE_RESERVAS_MIN;
  const desde = sumarMinutos(d.inicio, -m);
  const hasta = sumarMinutos(d.fin, m);
  const choque = db
    .prepare(
      `SELECT inicio, fin, organizacion FROM reservas
       WHERE espacio_id = ? AND estado = 'activa' AND inicio < ? AND fin > ?
       ORDER BY inicio LIMIT 1`
    )
    .get(espacio.id, hasta, desde);
  if (choque) {
    const margen = m > 0 ? ` (se exigen ${m} min entre reservas)` : '';
    throw conflicto(
      'ESPACIO_OCUPADO',
      `${espacio.nombre} ya está reservado de ${hora(choque.inicio)} a ${hora(choque.fin)}${margen}`
    );
  }
}

// R3: transmitir requiere televisor y HDMI operativos; cada equipo que transmite usa un HDMI
function equiposParaTransmision(db, espacio, d) {
  if (d.equipos_a_transmitir === 0) return [];
  const operativos = db
    .prepare(`SELECT id, codigo, tipo FROM recursos WHERE espacio_id = ? AND estado = 'operativo'`)
    .all(espacio.id);
  const tvs = operativos.filter((r) => r.tipo === 'televisor');
  const hdmis = operativos.filter((r) => r.tipo === 'cable_hdmi');
  if (tvs.length === 0 || hdmis.length === 0) {
    throw reglaIncumplida('SIN_EQUIPOS_TRANSMISION', `${espacio.nombre} no tiene televisor y HDMI operativos para transmitir`);
  }
  if (d.equipos_a_transmitir > hdmis.length) {
    throw reglaIncumplida(
      'HDMI_INSUFICIENTES',
      `${espacio.nombre} permite transmitir desde máximo ${hdmis.length} equipo(s) a la vez`
    );
  }
  return [...tvs, ...hdmis.slice(0, d.equipos_a_transmitir)];
}

/**
 * Crea una reserva aplicando todas las reglas dentro de una transacción.
 * `reglas` se puede sustituir en las pruebas; en producción se usa REGLAS.
 */
export function crearReserva(db, datos, reglas = REGLAS) {
  const d = validarEntrada(datos);
  validarHorario(d, reglas);

  return enTransaccion(db, () => {
    const espacio = db
      .prepare('SELECT * FROM espacios WHERE codigo = ? OR lower(nombre) = lower(?)')
      .get(d.espacio_codigo.toUpperCase(), d.espacio_codigo);
    if (!espacio) throw noEncontrado(`El espacio "${d.espacio_codigo}" no existe`);

    validarEspacioYAforo(espacio, d, reglas);
    validarSolapamiento(db, espacio, d, reglas);
    const equipos = equiposParaTransmision(db, espacio, d);

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO reservas (espacio_id, tipo_solicitante, organizacion, responsable, asistentes, inicio, fin, equipos_a_transmitir)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(espacio.id, d.tipo_solicitante, d.organizacion, d.responsable, d.asistentes, d.inicio, d.fin, d.equipos_a_transmitir);

    const insAsig = db.prepare('INSERT INTO asignaciones_recurso (reserva_id, recurso_id, inicio, fin) VALUES (?, ?, ?, ?)');
    for (const eq of equipos) insAsig.run(lastInsertRowid, eq.id, d.inicio, d.fin);

    return {
      id: Number(lastInsertRowid),
      espacio: espacio.nombre,
      ...d,
      equipos_asignados: equipos.map((e) => e.codigo),
    };
  });
}

export function cancelarReserva(db, id) {
  const r = db.prepare('SELECT id, estado FROM reservas WHERE id = ?').get(id);
  if (!r) throw noEncontrado(`La reserva ${id} no existe`);
  if (r.estado === 'cancelada') throw conflicto('YA_CANCELADA', `La reserva ${id} ya estaba cancelada`);
  db.prepare(`UPDATE reservas SET estado = 'cancelada' WHERE id = ?`).run(id);
  return { id, estado: 'cancelada' };
}

export function listarReservas(db, { espacio, fecha } = {}) {
  let sql = `SELECT r.*, e.codigo AS espacio_codigo, e.nombre AS espacio
             FROM reservas r JOIN espacios e ON e.id = r.espacio_id WHERE 1 = 1`;
  const p = [];
  if (espacio) { sql += ' AND (e.codigo = ? OR lower(e.nombre) = lower(?))'; p.push(espacio.toUpperCase(), espacio); }
  if (fecha) { sql += ' AND substr(r.inicio, 1, 10) = ?'; p.push(fecha); }
  return db.prepare(sql + ' ORDER BY r.inicio').all(...p);
}
