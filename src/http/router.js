// Router mínimo sobre node:http: suficiente para una API JSON, sin dependencias.
import { datoInvalido, ErrorDominio } from '../domain/errores.js';

const LIMITE_CUERPO = 20 * 1024; // 20 KB

export function crearRouter() {
  const rutas = [];
  const agregar = (metodo) => (patron, manejador) => {
    // '/api/reservas/:id/cancelar' → /^\/api\/reservas\/([^/]+)\/cancelar$/
    const nombres = [];
    const regex = new RegExp('^' + patron.replace(/:(\w+)/g, (_, n) => (nombres.push(n), '([^/]+)')) + '$');
    rutas.push({ metodo, regex, nombres, manejador });
  };

  async function leerJson(req) {
    let tam = 0;
    const partes = [];
    for await (const parte of req) {
      tam += parte.length;
      if (tam > LIMITE_CUERPO) throw new ErrorDominio(413, 'CUERPO_DEMASIADO_GRANDE', 'La solicitud es demasiado grande');
      partes.push(parte);
    }
    if (partes.length === 0) return {};
    try {
      return JSON.parse(Buffer.concat(partes).toString('utf8'));
    } catch {
      throw datoInvalido('El cuerpo de la solicitud no es JSON válido');
    }
  }

  async function atender(req) {
    const url = new URL(req.url, 'http://localhost');
    for (const r of rutas) {
      const m = r.metodo === req.method && url.pathname.match(r.regex);
      if (!m) continue;
      const params = Object.fromEntries(r.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await leerJson(req) : {};
      return r.manejador({ params, query: Object.fromEntries(url.searchParams), body });
    }
    return null; // ninguna ruta coincide
  }

  return { get: agregar('GET'), post: agregar('POST'), patch: agregar('PATCH'), atender };
}
