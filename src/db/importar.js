import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { leerCsvTexto } from './csv.js';
import { enTransaccion } from './transaccion.js';

const TIPOS_ESPACIO = ['aula', 'cubiculo'];
const ESTADOS_ESPACIO = ['habilitado', 'inhabilitado', 'mantenimiento'];
const TIPOS_RECURSO = ['televisor', 'cable_hdmi'];
const ESTADOS_RECURSO = ['operativo', 'danado', 'en_reparacion'];

const normalizar = (v) => (v ?? '').toString().trim();
const minus = (v) => normalizar(v).toLowerCase();

// Una fila con columnas de más o de menos no tumba el proceso: se valida y, si falla, se rechaza
const leerCsv = (ruta) => leerCsvTexto(readFileSync(ruta, 'utf8'));

function validarEspacio(f, codigosVistos) {
  const codigo = normalizar(f.codigo).toUpperCase();
  const nombre = normalizar(f.nombre);
  const tipo = minus(f.tipo);
  const estado = minus(f.estado);
  const aforo = Number(normalizar(f.aforo));

  if (!codigo) return { error: 'código vacío' };
  if (codigosVistos.has(codigo)) return { error: `código duplicado ${codigo}` };
  if (!nombre) return { error: 'nombre vacío' };
  if (!TIPOS_ESPACIO.includes(tipo)) return { error: `tipo no reconocido "${f.tipo}"` };
  if (!Number.isInteger(aforo) || aforo <= 0) return { error: `aforo inválido "${f.aforo}"` };
  if (!ESTADOS_ESPACIO.includes(estado)) return { error: `estado no reconocido "${f.estado}"` };
  return { valor: { codigo, nombre, tipo, aforo, estado } };
}

function validarRecurso(f, codigosVistos, espaciosPorCodigo) {
  const codigo = normalizar(f.codigo).toUpperCase();
  const tipo = minus(f.tipo);
  const estado = minus(f.estado);
  const espacioCodigo = normalizar(f.espacio_codigo).toUpperCase();

  if (!codigo) return { error: 'código vacío' };
  if (codigosVistos.has(codigo)) return { error: `código duplicado ${codigo}` };
  if (!TIPOS_RECURSO.includes(tipo)) return { error: `tipo no reconocido "${f.tipo}"` };
  if (!ESTADOS_RECURSO.includes(estado)) return { error: `estado no reconocido "${f.estado}"` };
  const espacioId = espaciosPorCodigo.get(espacioCodigo);
  if (!espacioId) return { error: `el espacio "${f.espacio_codigo}" no existe` };
  return { valor: { codigo, tipo, estado, espacio_id: espacioId } };
}

/**
 * Carga los archivos oficiales. Los registros válidos van a sus tablas y los
 * inválidos a import_errores con fila y motivo. Nunca lanza por un registro malo.
 */
export function importarDatosOficiales(db, dir) {
  const resumen = { espacios: 0, recursos: 0, rechazados: 0 };
  const insError = db.prepare(
    'INSERT INTO import_errores (archivo, fila, motivo, payload) VALUES (?, ?, ?, ?)'
  );
  const rechazar = (archivo, fila, motivo, datos) => {
    insError.run(archivo, fila, motivo, JSON.stringify(datos));
    resumen.rechazados++;
  };

  enTransaccion(db, () => {
    // Espacios
    const rutaEsp = join(dir, 'espacios.csv');
    if (!existsSync(rutaEsp)) throw new Error(`No se encontró ${rutaEsp}`);
    const insEsp = db.prepare(
      'INSERT INTO espacios (codigo, nombre, tipo, aforo, estado) VALUES (@codigo, @nombre, @tipo, @aforo, @estado)'
    );
    const vistosEsp = new Set();
    leerCsv(rutaEsp).forEach((f, i) => {
      const r = validarEspacio(f, vistosEsp);
      if (r.error) return rechazar('espacios.csv', i + 2, r.error, f); // +2: cabecera y base 1
      insEsp.run(r.valor);
      vistosEsp.add(r.valor.codigo);
      resumen.espacios++;
    });

    // Recursos (dependen de espacios)
    const rutaRec = join(dir, 'recursos.csv');
    if (existsSync(rutaRec)) {
      const espaciosPorCodigo = new Map(
        db.prepare('SELECT codigo, id FROM espacios').all().map((e) => [e.codigo, e.id])
      );
      const insRec = db.prepare(
        'INSERT INTO recursos (codigo, tipo, espacio_id, estado) VALUES (@codigo, @tipo, @espacio_id, @estado)'
      );
      const vistosRec = new Set();
      leerCsv(rutaRec).forEach((f, i) => {
        const r = validarRecurso(f, vistosRec, espaciosPorCodigo);
        if (r.error) return rechazar('recursos.csv', i + 2, r.error, f);
        insRec.run(r.valor);
        vistosRec.add(r.valor.codigo);
        resumen.recursos++;
      });
    }
  });

  return resumen;
}
