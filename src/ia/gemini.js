// Cliente mínimo de la Gemini API (REST generateContent), sin dependencias.
// Solo devuelve texto: interpretar y validar la respuesta es trabajo del dominio.

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const INTENTOS = 3;
const ESTADOS_REINTENTABLES = new Set([500, 502, 503, 504]);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export class ErrorIA extends Error { }

// Extrae solo el mensaje de error de Google (recortado); nunca el cuerpo completo ni la clave
async function motivoDeGoogle(res) {
  try {
    const cuerpo = await res.json();
    return String(cuerpo?.error?.message ?? '').slice(0, 200);
  } catch {
    return '';
  }
}

export function crearClienteGemini({
  apiKey = process.env.GEMINI_API_KEY,
  modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  timeoutMs = Number(process.env.IA_TIMEOUT_MS) || 15000,
} = {}) {
  return {
    modelo,
    configurado: Boolean(apiKey) && !apiKey.startsWith('coloca-aqui'),

    async generarJson({ instrucciones, mensaje }) {
      if (!this.configurado) throw new ErrorIA('La IA no está configurada (falta GEMINI_API_KEY en .env)');

      const peticion = () =>
        fetch(`${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instrucciones }] },
            contents: [{ role: 'user', parts: [{ text: mensaje }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

      let res;
      for (let intento = 1; intento <= INTENTOS; intento++) {
        try {
          res = await peticion();
        } catch (err) {
          if (intento === INTENTOS) {
            throw new ErrorIA(err.name === 'TimeoutError' ? 'La IA tardó demasiado en responder' : 'No se pudo contactar el servicio de IA');
          }
          await esperar(1000 * 2 ** (intento - 1));
          continue;
        }
        if (res.ok || !ESTADOS_REINTENTABLES.has(res.status) || intento === INTENTOS) break;
        await esperar(1000 * 2 ** (intento - 1)); // 1 s, 2 s
      }

      if (!res.ok) {
        const detalle = await motivoDeGoogle(res);
        const motivo = res.status === 429 ? 'límite de uso de la IA alcanzado' : `el servicio de IA respondió ${res.status}`;
        throw new ErrorIA(`No se pudo clasificar: ${motivo}${detalle ? ` (${detalle})` : ''}`);
      }

      const datos = await res.json().catch(() => null);
      const texto = datos?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!texto) throw new ErrorIA('La IA devolvió una respuesta vacía');
      return texto;
    },
  };
} 