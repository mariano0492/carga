// Guardado de datos en el celular (localStorage). Todo vive en un solo objeto
// que se guarda completo después de cada cambio.
const KEY = 'carga:v1';

export const dateKey = (d = new Date()) => {
  const x = new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};

function blank() {
  return {
    v: 2,
    profile: null,          // { bw, sex, goals:{kcal,p,c,g}, orm:{sentadilla,…}, created }
    settings: { apiKey: '', model: 'claude-opus-5', voice: true },
    plans: [],              // { id, type, split, name, created, days:[{ id, n, t, slots }] }
    activePlan: null,       // id del plan en uso
    rot: { done: [], pin: null }, // días hechos en esta vuelta de la rotación; pin: próximo día elegido a mano
    current: null,          // entrenamiento en curso, con una copia del día: { planId, day, started, sel, alt, sets }
    sessions: [],           // entrenamientos terminados: { id, date, planId, planName, dayId, dayName, dur, sets, swaps, survey }
    bodyweight: [],         // { d:'YYYY-MM-DD', kg }
    wellness: {},           // 'YYYY-MM-DD': { s, e, m }
    meals: [],              // { id, d, t, label, text, kcal, p, c, g, src }
    runs: [],               // { id, date, mode, dur, dist, laps }
    chat: [],               // { role, content }
    savedRecipes: [],
    lastFeedback: null,
  };
}

let state = load();
let persistOk = true;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const data = JSON.parse(raw);
    // v1 → v2: los entrenamientos de la versión anterior eran de prueba y se descartan
    if (data.v === 1) {
      const s = migrate(data, false);
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
      return s;
    }
    return { ...blank(), ...data };
  } catch (e) {
    return blank();
  }
}

/* Pasa datos de la versión 1 (programa fijo A/B/C) a la 2 (planes). El plan lo crea la app al arrancar.
   `keepSessions`: las copias de seguridad conservan sus entrenamientos con el nombre del día. */
function migrate(data, keepSessions) {
  const out = { ...blank(), ...data, v: 2, plans: [], activePlan: null, rot: { done: [], pin: null }, current: null, lastFeedback: null };
  delete out.nextDay;
  out.sessions = keepSessions
    ? (data.sessions || []).map((s) => ({ ...s, planId: null, planName: 'Fuerza · 3 días', dayId: null, dayName: 'Día ' + s.day, swaps: [] }))
    : [];
  return out;
}

export const S = () => state;

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    persistOk = true;
  } catch (e) {
    persistOk = false;
  }
  return persistOk;
}
export const canPersist = () => persistOk;

/* Aplica un cambio y guarda */
export function update(fn) {
  fn(state);
  return save();
}

export function exportJSON() {
  return JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '' }, exportedAt: new Date().toISOString() }, null, 2);
}

/* Importa una copia de seguridad. Conserva la clave de API del celular. */
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || ![1, 2].includes(data.v) || !Array.isArray(data.sessions)) throw new Error('El archivo no es una copia de Carga.');
  const apiKey = state.settings.apiKey;
  const d = data.v === 1 ? migrate(data, true) : data;
  state = { ...blank(), ...d, settings: { ...blank().settings, ...d.settings, apiKey } };
  delete state.exportedAt;
  save();
}

export function resetAll() {
  const apiKey = state.settings.apiKey;
  state = blank();
  state.settings.apiKey = apiKey;
  save();
}

/* Pide al navegador que no borre los datos si el celular se queda sin espacio */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) {}
  return false;
}
