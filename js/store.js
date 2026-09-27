// Guardado de datos en el celular (localStorage). Todo vive en un solo objeto
// que se guarda completo después de cada cambio.
const KEY = 'carga:v1';

export const dateKey = (d = new Date()) => {
  const x = new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};

function blank() {
  return {
    v: 1,
    profile: null,          // { bw, sex, goals:{kcal,p,c,g}, orm:{sentadilla,…}, created }
    settings: { apiKey: '', model: 'claude-opus-5', voice: true },
    nextDay: 'A',
    current: null,          // entrenamiento en curso
    sessions: [],           // entrenamientos terminados
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
    return { ...blank(), ...JSON.parse(raw) };
  } catch (e) {
    return blank();
  }
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
  if (!data || data.v !== 1 || !Array.isArray(data.sessions)) throw new Error('El archivo no es una copia de Carga.');
  const apiKey = state.settings.apiKey;
  state = { ...blank(), ...data, settings: { ...blank().settings, ...data.settings, apiKey } };
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
