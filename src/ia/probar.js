// npm run ia:probar → hace UNA llamada real a Gemini para comprobar clave y modelo antes de la demo.
import { existsSync } from 'node:fs';
import { crearClienteGemini } from './gemini.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const ia = crearClienteGemini();
console.log(`Modelo: ${ia.modelo}`);
try {
  const t = await ia.generarJson({
    instrucciones: 'Responde solo con JSON: {"ok": true, "modelo": "<tu nombre de modelo>"}',
    mensaje: 'Prueba de conexión',
  });
  console.log('Respuesta real de Gemini:', t);
} catch (err) {
  console.error('Falló:', err.message);
  process.exitCode = 1;
}
