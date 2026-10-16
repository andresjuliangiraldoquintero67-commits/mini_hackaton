import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env'); // lee .env sin dependencias (Node 22)

const { abrirBase, inicializar } = await import('./db/conexion.js');
const { crearApp } = await import('./app.js');
const { crearClienteGemini } = await import('./ia/gemini.js');

const db = abrirBase(process.env.DB_PATH || './data/campus.db');
const resumen = inicializar(db);
if (resumen) {
  console.log(`Datos oficiales cargados: ${resumen.espacios} espacios, ${resumen.recursos} recursos, ${resumen.rechazados} rechazados`);
}

const ia = crearClienteGemini();
console.log(ia.configurado ? `IA: Gemini (${ia.modelo})` : 'IA: sin configurar. Las incidencias quedarán pendientes de triaje manual.');

const puerto = Number(process.env.PORT) || 3000;
crearApp(db, ia).listen(puerto, () => console.log(`Campus Ops en http://localhost:${puerto}`));
