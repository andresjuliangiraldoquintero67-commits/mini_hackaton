import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearRouter } from './http/router.js';
import { ErrorDominio, datoInvalido } from './domain/errores.js';
import { crearReserva, cancelarReserva, listarReservas } from './domain/reservas.js';
import { listarEspacios, cambiarEstadoEspacio, listarErroresImportacion } from './domain/espacios.js';
import { listarRecursos, cambiarEstadoRecurso, historialRecurso } from './domain/recursos.js';
import {
  reportarIncidencia, clasificarManual, cambiarEstadoIncidencia, aplicarSugerencia, listarIncidencias,
  CATEGORIAS, PRIORIDADES, AREAS,
} from './domain/incidencias.js';

const PUBLICO = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function enviarJson(res, status, datos) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(datos));
}

async function servirEstatico(pathname, res) {
  const ruta = join(PUBLICO, normalize(pathname === '/' ? '/index.html' : pathname));
  if (!ruta.startsWith(PUBLICO)) return false; // evita ../ fuera de public
  try {
    const contenido = await readFile(ruta);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(contenido);
    return true;
  } catch {
    return false;
  }
}

const idValido = (v) => {
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) throw datoInvalido('Id inválido');
  return id;
};

export function crearApp(db, clienteIA) {
  const api = crearRouter();
  const creado = (datos) => ({ status: 201, datos });

  api.get('/api/salud', () => ({ ok: true }));
  api.get('/api/catalogos', () => ({ categorias: CATEGORIAS, prioridades: PRIORIDADES, areas: AREAS }));
  api.get('/api/ia/estado', () => ({ configurado: clienteIA.configurado, modelo: clienteIA.modelo }));
  api.get('/api/importacion/errores', () => listarErroresImportacion(db));

  // Módulo 1: espacios y reservas
  api.get('/api/espacios', () => listarEspacios(db));
  api.patch('/api/espacios/:codigo/estado', ({ params, body }) => cambiarEstadoEspacio(db, params.codigo, body));
  api.get('/api/reservas', ({ query }) => listarReservas(db, { espacio: query.espacio, fecha: query.fecha }));
  api.post('/api/reservas', ({ body }) => creado(crearReserva(db, body)));
  api.patch('/api/reservas/:id/cancelar', ({ params }) => cancelarReserva(db, idValido(params.id)));

  // Módulo 2: recursos tecnológicos
  api.get('/api/recursos', () => listarRecursos(db));
  api.patch('/api/recursos/:codigo/estado', ({ params, body }) => cambiarEstadoRecurso(db, params.codigo, body));
  api.get('/api/recursos/:codigo/historial', ({ params }) => historialRecurso(db, params.codigo));

  // Módulo 3: incidencias con IA
  api.get('/api/incidencias', () => listarIncidencias(db));
  api.post('/api/incidencias', async ({ body }) => creado(await reportarIncidencia(db, clienteIA, body)));
  api.patch('/api/incidencias/:id/clasificacion', ({ params, body }) => clasificarManual(db, idValido(params.id), body));
  api.patch('/api/incidencias/:id/estado', ({ params, body }) => cambiarEstadoIncidencia(db, idValido(params.id), body));
  api.post('/api/incidencias/:id/aplicar-sugerencia', ({ params }) => aplicarSugerencia(db, idValido(params.id)));

  return createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        const resultado = await api.atender(req);
        if (resultado === null) return enviarJson(res, 404, { error: { codigo: 'RUTA_INEXISTENTE', mensaje: 'Ruta no encontrada' } });
        if (resultado && resultado.status) return enviarJson(res, resultado.status, resultado.datos);
        return enviarJson(res, 200, resultado);
      }
      if (req.method === 'GET' && (await servirEstatico(new URL(req.url, 'http://x').pathname, res))) return;
      res.writeHead(404).end('No encontrado');
    } catch (err) {
      // Los errores de negocio se muestran; los inesperados no filtran detalles internos
      if (err instanceof ErrorDominio) {
        return enviarJson(res, err.status, { error: { codigo: err.codigo, mensaje: err.message } });
      }
      console.error('[error interno]', err.message);
      enviarJson(res, 500, { error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.' } });
    }
  });
}
