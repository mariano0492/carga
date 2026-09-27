// IA con Claude. La app llama a la API directo desde el celular con la clave
// que cargás en Ajustes; la clave queda guardada solo en este dispositivo.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';

export const MODELS = {
  'claude-opus-5': { label: 'Claude Opus 5', note: 'El más capaz. Recomendado.', effort: true, fallbacks: true },
  'claude-sonnet-5': { label: 'Claude Sonnet 5', note: 'Más barato, muy bueno para esto.', effort: true },
  'claude-haiku-4-5': { label: 'Claude Haiku 4.5', note: 'El más barato y rápido.', effort: false },
};

let Anthropic = null;
async function sdk() {
  if (!Anthropic) Anthropic = (await import(SDK_URL)).default;
  return Anthropic;
}

async function client(apiKey) {
  const A = await sdk();
  return new A({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/* Arma el pedido según el modelo. Opus 5 usa respaldo automático del servidor
   (fallbacks) por si un filtro de seguridad rechaza el pedido. */
function build(model, { system, messages, maxTokens, effort, format }) {
  const cfg = MODELS[model] || MODELS['claude-opus-5'];
  const req = { model, max_tokens: maxTokens, system, messages };
  const oc = {};
  if (cfg.effort && effort) oc.effort = effort;
  if (format) oc.format = format;
  if (Object.keys(oc).length) req.output_config = oc;
  if (cfg.fallbacks) {
    req.betas = ['server-side-fallback-2026-07-01'];
    req.fallbacks = 'default';
  }
  return { req, beta: !!cfg.fallbacks };
}

/* Traduce los errores de la API a mensajes para la persona */
export async function explainError(err) {
  const A = Anthropic || (await sdk().catch(() => null));
  if (!navigator.onLine) return 'No hay conexión. La IA necesita internet.';
  if (A) {
    if (err instanceof A.AuthenticationError) return 'La clave de API no es válida. Revisala en Ajustes.';
    if (err instanceof A.PermissionDeniedError) return 'Tu clave no tiene permiso para este modelo. Probá otro en Ajustes.';
    if (err instanceof A.RateLimitError) return 'Demasiados pedidos seguidos. Esperá un minuto y probá de nuevo.';
    if (err instanceof A.BadRequestError) return 'La API rechazó el pedido: ' + err.message;
    if (err instanceof A.APIConnectionError) return 'No se pudo conectar con la API. Revisá tu conexión.';
    if (err instanceof A.APIError) return 'Error de la API (' + err.status + '). Probá de nuevo en un rato.';
  }
  return err && err.message ? err.message : 'Algo falló con la IA.';
}

class RefusalError extends Error {}
function checkStop(msg) {
  if (msg.stop_reason === 'refusal') throw new RefusalError('Claude no pudo responder este pedido. Probá escribirlo de otra forma.');
}
const textOf = (msg) => msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

/* Verifica la clave sin gastar: listar modelos no consume tokens */
export async function testKey(apiKey) {
  const c = await client(apiKey);
  await c.models.list({ limit: 1 });
  return true;
}

/* ---------- Comidas: texto libre → calorías y macros ---------- */
const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          cantidad: { type: 'string' },
          kcal: { type: 'number' },
          p: { type: 'number' },
          c: { type: 'number' },
          g: { type: 'number' },
        },
        required: ['nombre', 'cantidad', 'kcal', 'p', 'c', 'g'],
        additionalProperties: false,
      },
    },
    nota: { type: 'string' },
  },
  required: ['items', 'nota'],
  additionalProperties: false,
};

const MEAL_SYSTEM = `Sos un nutricionista que estima calorías y macronutrientes de comidas descritas en español rioplatense.
Para cada alimento, estimá una cantidad razonable si no se indica (porciones típicas de Argentina) y devolvé kcal, proteínas (p), carbohidratos (c) y grasas (g) en gramos para esa cantidad.
En "nota" escribí una frase corta útil para alguien que entrena fuerza (por ejemplo, si la comida aporta poca proteína). Si el texto no describe comida, devolvé items vacío y explicalo en la nota.`;

export async function parseMeal({ apiKey, model }, text) {
  const c = await client(apiKey);
  const { req, beta } = build(model, {
    system: MEAL_SYSTEM,
    messages: [{ role: 'user', content: text }],
    maxTokens: 4000,
    effort: 'low',
    format: { type: 'json_schema', schema: MEAL_SCHEMA },
  });
  const msg = beta ? await c.beta.messages.create(req) : await c.messages.create(req);
  checkStop(msg);
  const data = JSON.parse(textOf(msg));
  const tot = data.items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, c: a.c + i.c, g: a.g + i.g }), { kcal: 0, p: 0, c: 0, g: 0 });
  return { ...data, tot };
}

/* ---------- Coach: chat con el contexto de tu entrenamiento ---------- */
const COACH_SYSTEM = `Sos el coach de fuerza de Carga, una app personal de entrenamiento. Hablás en español rioplatense, de forma directa y breve (máximo 180 palabras salvo que te pidan un plan).
La persona entrena fuerza 3 días por semana con un programa de cuerpo completo (días A, B y C) y también sale a correr. Usá los datos del contexto: series recientes, recuperación de cada músculo, puntaje del día, peso corporal y nutrición. Citá números concretos cuando ayuden.
No inventes datos que no están en el contexto. Si algo suena a lesión (dolor punzante, que empeora o dura más de una semana), recomendá consultar a un profesional de la salud.
Escribí en texto plano: sin títulos con #, sin tablas. Podés usar listas cortas con guiones.`;

export async function coachStream({ apiKey, model }, history, context, onText) {
  const c = await client(apiKey);
  const messages = history.map((m, i) => (
    i === history.length - 1 && m.role === 'user'
      ? { role: 'user', content: `Contexto actual de la app (datos reales de la persona):\n${context}\n\nPregunta: ${m.content}` }
      : { role: m.role, content: m.content }
  ));
  const { req, beta } = build(model, { system: COACH_SYSTEM, messages, maxTokens: 8000, effort: 'medium' });
  const stream = beta ? c.beta.messages.stream(req) : c.messages.stream(req);
  for await (const ev of stream) {
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') onText(ev.delta.text);
  }
  const msg = await stream.finalMessage();
  checkStop(msg);
  return textOf(msg);
}
