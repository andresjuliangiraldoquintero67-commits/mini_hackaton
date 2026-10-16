import { DatabaseSync } from 'node:sqlite'; // SQLite incluido en Node 22: sin dependencias nativas que instalar
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importarDatosOficiales } from './importar.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUTA_DATOS_RAW = resolve(AQUI, '../../data/raw');

export function abrirBase(ruta = ':memory:') {
  if (ruta !== ':memory:') mkdirSync(dirname(resolve(ruta)), { recursive: true });
  const db = new DatabaseSync(ruta);
  if (ruta !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(readFileSync(resolve(AQUI, 'esquema.sql'), 'utf8'));
  return db;
}

// Si la base está vacía, carga los datos oficiales. Así `npm start` funciona en una máquina limpia.
export function inicializar(db, dirDatos = RUTA_DATOS_RAW) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM espacios').get();
  if (n > 0) return null;
  return importarDatosOficiales(db, dirDatos);
}
