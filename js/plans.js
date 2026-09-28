// Planes de entrenamiento: generarlos desde las plantillas, editarlos y revisarlos.
import { MUSCLES, EXERCISES, DAY_TPL, SPLITS, PLAN_TYPES } from './data.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const muscle = (id) => MUSCLES.find((m) => m.id === id);

export const splitsFor = (days) => SPLITS[days] || [];
export const defaultName = (type, days) => PLAN_TYPES[type].n + ' · ' + days + ' días';
export const splitLabel = (plan) => {
  const sp = Object.values(SPLITS).flat().find((s) => s.id === plan.split);
  return sp ? sp.n : plan.type === 'manual' ? 'Armado a mano' : 'Personalizado';
};

/* Plan nuevo. Fuerza copia las plantillas del split elegido; manual arranca con días vacíos. */
export function newPlan(type, days, splitId, name) {
  let list, split = null;
  if (type === 'manual') list = Array.from({ length: days }, (_, i) => ({ n: 'Día ' + (i + 1), t: '', slots: [] }));
  else {
    const sp = splitsFor(days).find((s) => s.id === splitId) || splitsFor(days)[0];
    split = sp.id; list = sp.days.map((k) => DAY_TPL[k]());
  }
  return { id: uid(), type, split, name: (name || '').trim() || defaultName(type, days), created: new Date().toISOString(), days: list.map((d) => ({ id: uid(), ...d })) };
}
export const newDay = (n) => ({ id: uid(), n, t: '', slots: [] });
export const splitDayNames = (sp) => sp.days.map((k) => DAY_TPL[k]().n);

/* Explicación de cada ejercicio tomada de las plantillas, para las alternativas */
const WHY = {};
Object.values(DAY_TPL).forEach((f) => f().slots.forEach((s) => s.opts.forEach((x) => { if (x.why && !WHY[x.id]) WHY[x.id] = x.why; })));

const isIso = (e) => ['brazos', 'pant'].includes(e.m[0]) || /face|fly|jaros|pull-apart|patada|femoral/i.test(e.n);
export function defaultsFor(id) {
  const e = EXERCISES[id];
  if (e.big) return { sets: 4, reps: 5, rir: 2, rest: 180 };
  if (isIso(e)) return { sets: 3, reps: 12, rir: 2, rest: 60 };
  return { sets: 3, reps: 8, rir: 2, rest: 120 };
}
/* Alternativas del catálogo: mismo músculo principal, primero las del mismo tipo (básico pesado, compuesto o aislamiento) */
export const kind = (id) => (EXERCISES[id].big ? 0 : isIso(EXERCISES[id]) ? 2 : 1);
export const altsFor = (id) => Object.keys(EXERCISES).filter((k) => k !== id && EXERCISES[k].m[0] === EXERCISES[id].m[0])
  .sort((a, b) => Math.abs(kind(a) - kind(id)) - Math.abs(kind(b) - kind(id)));
const listJoin = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]);

/* Bloque nuevo a partir de un ejercicio del catálogo. `keep` conserva series, reps, RIR y descanso. */
export function makeSlot(id, keep) {
  const e = EXERCISES[id], d = keep ? { sets: keep.sets, reps: keep.reps, rir: keep.rir, rest: keep.rest } : defaultsFor(id);
  const alts = altsFor(id).slice(0, 4).map((k, i) => ({ id: k, ...defaultsFor(k), rec: i === 0, why: WHY[k] || 'Trabaja el mismo músculo' }));
  return { p: muscle(e.m[0]).n, m: e.m.map((x) => muscle(x).n.toLowerCase()).join(', '), opts: [{ id, ...d }, ...alts] };
}

/* Cambia el ejercicio principal de un bloque. Si ya era una alternativa, la sube; si no, arma un bloque nuevo. */
export function setSlotExercise(slot, id) {
  const cur = slot.opts[0], i = slot.opts.findIndex((x) => x.id === id);
  if (i === 0) return slot;
  const keep = { sets: cur.sets, reps: cur.reps, rir: cur.rir, rest: cur.rest };
  if (i > 0) {
    const opts = slot.opts.filter((x) => x.id !== id).map((x) => ({ ...x, rec: false, why: x.why || WHY[x.id] || 'El ejercicio anterior del plan' }));
    opts[0].rec = true;
    return { ...slot, opts: [{ id, ...keep }, ...opts] };
  }
  const same = EXERCISES[id].m[0] === EXERCISES[cur.id].m[0];
  const s = makeSlot(id, same ? keep : null);
  return same ? { ...s, p: slot.p, m: slot.m } : s;
}

/* Minutos estimados: 10 de entrada en calor + cada serie (unos 40 s) con su descanso */
export const estMinutes = (day) => Math.round((600 + day.slots.reduce((a, s) => a + s.opts[0].sets * (40 + s.opts[0].rest), 0)) / 60);

/* Series por músculo en una vuelta completa de la rotación (una semana) */
export function weeklySets(plan) {
  const c = {};
  plan.days.forEach((d) => d.slots.forEach((s) => { const x = s.opts[0]; EXERCISES[x.id].m.forEach((m) => (c[m] = (c[m] || 0) + x.sets)); }));
  return c;
}

/* Recomendaciones sobre el plan: volumen por músculo, choques de recuperación y duración */
export function reviewPlan(plan) {
  const out = [], ws = weeklySets(plan), N = plan.days.length;
  plan.days.forEach((d, i) => { if (!d.slots.length) out.push({ lvl: 'warn', t: `El día ${i + 1} (${d.n}) no tiene ejercicios. Agregale al menos uno.` }); });
  MUSCLES.forEach((m) => {
    const n = ws[m.id] || 0;
    if (n < m.target * 0.6) out.push({ lvl: n < m.target * 0.4 ? 'warn' : 'info', t: `Pocas series de ${m.n.toLowerCase()} por semana: ${n} de ${m.target}. Sumá un ejercicio de ${m.n.toLowerCase()} en algún día.` });
    else if (n > m.target * 2) out.push({ lvl: 'info', t: `Muchas series de ${m.n.toLowerCase()} por semana (${n}, la meta es ${m.target}). Puede costarte recuperarte.` });
  });
  // choque: el mismo músculo recibe 5 o más series como principal en dos días seguidos
  const prim = (d) => { const c = {}; d.slots.forEach((s) => { const m = EXERCISES[s.opts[0].id].m[0]; c[m] = (c[m] || 0) + s.opts[0].sets; }); return new Set(Object.keys(c).filter((m) => c[m] >= 5)); };
  for (let i = 0; i < N - 1; i++) {
    const a = prim(plan.days[i]), b = prim(plan.days[i + 1]);
    const both = [...a].filter((m) => b.has(m)).map(muscle);
    if (both.length) out.push({ lvl: 'info', t: `El día ${i + 1} (${plan.days[i].n}) y el día ${i + 2} (${plan.days[i + 1].n}) cargan fuerte ${listJoin(both.map((m) => m.n.toLowerCase()))}. Si los hacés en días seguidos, no llega a recuperarse (${Math.max(...both.map((m) => m.need))} h). Dejá un día de descanso entre los dos.` });
  }
  plan.days.forEach((d) => { const mn = estMinutes(d); if (mn > 90) out.push({ lvl: 'info', t: `${d.n} dura unos ${mn} min. Si tenés menos tiempo, sacá series de los accesorios.` }); });
  return out;
}
