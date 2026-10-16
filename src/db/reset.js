// npm run reset → borra la base operativa y la reconstruye desde data/raw (los originales no se tocan).
import { existsSync, rmSync } from 'node:fs';
import { abrirBase, inicializar } from './conexion.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const ruta = process.env.DB_PATH || './data/campus.db';
for (const sufijo of ['', '-wal', '-shm']) rmSync(ruta + sufijo, { force: true });

const db = abrirBase(ruta);
const resumen = inicializar(db);
const errores = db.prepare('SELECT archivo, fila, motivo FROM import_errores').all();
db.close();

console.log(`Importación: ${resumen.espacios} espacios, ${resumen.recursos} recursos, ${resumen.rechazados} rechazados`);
for (const e of errores) console.log(`  - ${e.archivo} fila ${e.fila}: ${e.motivo}`);
