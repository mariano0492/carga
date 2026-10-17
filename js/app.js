import { MUSCLES, EXERCISES, MAIN_LIFTS, LEVELS, STANDARDS, FOODS, RECIPES, QUOTES, SONGS, PLAN_TYPES, MIN_DAYS, MAX_DAYS } from './data.js';
import * as PL from './plans.js';
import { S, save, update, dateKey, exportJSON, importJSON, resetAll, requestPersistence, canPersist } from './store.js';
import * as AI from './ai.js';

const VERSION = '1.4.0';

/* ---------- utilidades ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n, d = 1) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const mmss = (s) => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const mss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const roundTo = (v, step) => Math.round(v / step) * step;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
/* 1RM estimado (Epley) contando las repeticiones que quedaron en reserva */
const e1rm = (w, r, rir = 0) => { const n = r + (rir || 0); return n <= 1 ? w : Math.round(w * (1 + n / 30) * 2) / 2; };
const H = 3600e3, DAY = 24 * H;
const WD = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WD_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const shortDate = (d) => { d = new Date(d); return WD[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1); };
function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

let toastT;
function toast(msg, pr) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (pr ? ' pr' : '');
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast' + (pr ? ' pr' : '')), 2800);
}
let actx;
function beep(freq = 880, dur = 0.18, times = 1) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.25;
      o.frequency.value = freq; g.gain.setValueAtTime(0.25, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur);
    }
  } catch (e) {}
}
function buzz(pattern = 200) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }

/* Pantalla encendida mientras entrenás o corrés */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (run.on || (S().current && S().current.started)) keepAwake(true);
    if (screen === 'correr') paintRun();
  }
});

/* ---------- Segundo plano: celular bloqueado ----------
   Android frena las páginas con la pantalla apagada, salvo las que reproducen audio.
   Mientras corrés o descansás, la app reproduce un audio inaudible: así los tiempos,
   los pitidos y la voz siguen andando, y el estado se ve en la pantalla de bloqueo
   como un reproductor de música. Al terminar un descanso o cambiar de fase, además
   muestra una notificación que vibra. */
const bg = { audio: null, reasons: new Set(), t: null, asked: false };
function quietWavUrl() {
  const sr = 8000, n = sr * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, (Math.random() * 4 - 2) | 0, true); // ruido de ±2/32768: inaudible
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function bgHold(reason, on) {
  const had = bg.reasons.size > 0;
  on ? bg.reasons.add(reason) : bg.reasons.delete(reason);
  const need = bg.reasons.size > 0;
  if (need && !had) {
    askNotify();
    try {
      if (!bg.audio) { bg.audio = new Audio(quietWavUrl()); bg.audio.loop = true; }
      bg.audio.play().catch(() => {});
    } catch (e) {}
    setupMediaActions();
    clearInterval(bg.t); bg.t = setInterval(mediaTick, 1000); mediaTick();
  } else if (!need && had) {
    try { bg.audio && bg.audio.pause(); } catch (e) {}
    clearInterval(bg.t);
    if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; }
  }
}
async function askNotify() {
  if (bg.asked || !('Notification' in window) || Notification.permission !== 'default') return;
  bg.asked = true;
  try { await Notification.requestPermission(); } catch (e) {}
}
/* Solo avisa con notificación si la app no está a la vista */
async function notify(title, body) {
  try {
    if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [250, 100, 250, 100, 250], tag: 'carga-aviso', renotify: true });
  } catch (e) {}
}
document.addEventListener('pointerdown', () => { if (bg.reasons.size && bg.audio && bg.audio.paused) bg.audio.play().catch(() => {}); });
let mediaReady = false;
function setupMediaActions() {
  if (mediaReady || !('mediaSession' in navigator)) return;
  mediaReady = true;
  const ms = navigator.mediaSession;
  const playPause = () => { if (run.on || run.elapsed) toggleRun(); else if (tm.left > 0 && tm.left < tm.total || tm.on) $('#tmStart').click(); mediaTick(); };
  try { ms.setActionHandler('play', playPause); ms.setActionHandler('pause', playPause); } catch (e) {}
  try {
    ms.setActionHandler('nexttrack', () => {
      if (run.on) $('#runLap').click();
      else if (restEnd > Date.now()) $('#restSkip').click();
      mediaTick();
    });
  } catch (e) {}
}
function mediaTick() {
  if (!('mediaSession' in navigator) || !bg.reasons.size) return;
  let title, artist;
  if (run.on || run.elapsed) {
    title = mmss(run.elapsed) + ' · ' + fmt(run.dist / 1000, 2) + ' km';
    artist = run.mode === 'int' && run.phase !== 'done'
      ? (run.phase === 'fast' ? 'Rápido' : 'Suave') + ' · quedan ' + mss(Math.ceil(run.phaseLeft)) + ' · ronda ' + run.round + '/' + run.cfg.rounds
      : run.on ? 'Corriendo' : 'En pausa';
  } else if (restEnd > Date.now()) {
    title = 'Descanso ' + mss(Math.ceil((restEnd - Date.now()) / 1000));
    artist = 'Después, siguiente serie';
  } else if (tm.on) {
    title = 'Descanso ' + mss(Math.ceil(tm.left));
    artist = 'Temporizador';
  } else return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Carga', artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    navigator.mediaSession.playbackState = run.elapsed && !run.on ? 'paused' : 'playing';
  } catch (e) {}
}

/* ---------- navegación ---------- */
const SCREENS = ['hoy', 'entrenar', 'correr', 'progreso', 'nutricion', 'coach', 'ajustes', 'plan'];
let screen = 'hoy', planFrom = 'entrenar';
let pv = { mode: 'list' }, pvKeep = false; // vista de Mi plan: lista, asistente o editor de un día
function go(tab) {
  if (!SCREENS.includes(tab)) tab = 'hoy';
  if (tab === 'plan' && screen !== 'plan') { planFrom = screen === 'ajustes' ? 'ajustes' : 'entrenar'; if (!pvKeep) pv = { mode: 'list' }; }
  pvKeep = false;
  screen = tab;
  $$('[data-screen]').forEach((s) => (s.hidden = s.dataset.screen !== tab));
  $$('nav [data-tab]').forEach((b) => (b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $('#main').scrollTop = 0;
  $('#rest').hidden = !(tab === 'entrenar' && restEnd > Date.now());
  history.replaceState(null, '', '#' + tab);
  RENDER[tab] && RENDER[tab]();
}
$$('nav [data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
document.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

/* ---------- historial ---------- */
const sessions = () => S().sessions;
function lastSetsFor(exId) {
  for (let i = sessions().length - 1; i >= 0; i--) {
    const sets = sessions()[i].sets.filter((s) => s.ex === exId);
    if (sets.length) return { date: sessions()[i].date, sets: sets.map((s) => [s.kg, s.reps, s.rir]) };
  }
  return null;
}
function bestE1RM(exId, since = 0) {
  let best = 0, at = null;
  for (const s of sessions()) {
    if (new Date(s.date).getTime() < since) continue;
    for (const x of s.sets) if (x.ex === exId && x.kg > 0) { const v = e1rm(x.kg, x.reps, x.rir); if (v > best) { best = v; at = { ...x, date: s.date }; } }
  }
  return { best, at };
}
function currentBW() {
  const b = S().bodyweight;
  return b.length ? b[b.length - 1].kg : (S().profile ? S().profile.bw : 0);
}

/* ---------- puntaje del día ---------- */
const todayK = () => dateKey();
const wellnessToday = () => S().wellness[todayK()] || { s: 4, e: 3, m: 1 };
const readiness = () => { const w = wellnessToday(); return Math.round(((w.s - 1) + (w.e - 1) + (5 - w.m)) / 12 * 100); };
function rdLevel(score = readiness()) {
  if (score >= 70) return { f: 1, cls: 'good', t: 'Listo para entrenar', x: 'Entrená como está planeado.' };
  if (score >= 50) return { f: 0.95, cls: 'mid', t: 'Día intermedio', x: 'Bajamos 5% los pesos sugeridos y hoy no buscamos récords.' };
  return { f: 0.9, cls: 'low', t: 'Día para ir liviano', x: 'Bajamos 10% los pesos. Si podés, cambiá la sesión por descanso activo.' };
}

/* ---------- plan activo y rotación ---------- */
/* Plan en uso. Si no hay (datos viejos o una copia sin planes), usa el primero guardado o crea Fuerza · 3 días. */
function plan() {
  const p = S().plans.find((x) => x.id === S().activePlan);
  if (p) return p;
  update((st) => {
    if (!st.plans.length) st.plans.push(PL.newPlan('fuerza', 3, 'full3'));
    st.activePlan = st.plans[0].id; st.rot = { done: [], pin: null };
  });
  return S().plans[0];
}
const planDays = () => plan().days.length;
const ensurePlan = () => { plan(); };
/* Próximo día: el elegido a mano o el primero de la rotación que falta en esta vuelta */
function nextDay() {
  const p = plan(), r = S().rot;
  return p.days.find((d) => d.id === r.pin) || p.days.find((d) => !r.done.includes(d.id)) || p.days[0];
}

/* ---------- recuperación muscular ----------
   Cada sesión deja al músculo recuperándose sus horas base (`need`): 25% más si hizo
   más de 6 series y 25% menos si hizo 2 o menos. Manda la sesión que termina más tarde. */
const volFactor = (n) => (n > 6 ? 1.25 : n <= 2 ? 0.75 : 1);
function muscleState() {
  const now = Date.now(), acc = {};
  const hit = (m, t, need, what) => {
    const a = acc[m] || (acc[m] = { last: 0, ready: 0, from: 0, what: '' });
    if (t > a.last) { a.last = t; a.what = what; }
    if (t + need * H > a.ready) { a.ready = t + need * H; a.from = t; }
  };
  for (const s of sessions()) {
    const t = new Date(s.date).getTime(), n = {}, first = {};
    s.sets.forEach((x) => (EXERCISES[x.ex]?.m || []).forEach((m) => { n[m] = (n[m] || 0) + 1; first[m] = first[m] || EXERCISES[x.ex].n; }));
    MUSCLES.forEach((m) => { if (n[m.id]) hit(m.id, t, m.need * volFactor(n[m.id]), first[m.id] + ', ' + n[m.id] + (n[m.id] === 1 ? ' serie' : ' series')); });
  }
  for (const r of S().runs) hit('pant', new Date(r.date).getTime(), 48, 'carrera ' + fmt(r.dist / 1000, 1) + ' km');
  const out = {};
  MUSCLES.forEach((m) => {
    const a = acc[m.id];
    if (!a) { out[m.id] = { ...m, h: Infinity, left: 0, pct: 100, st: 'ready', lastTxt: 'Sin registros todavía' }; return; }
    const left = Math.max(0, Math.ceil((a.ready - now) / H));
    out[m.id] = { ...m, h: Math.floor((now - a.last) / H), left, pct: Math.min(100, Math.round((now - a.from) / (a.ready - a.from) * 100)),
      st: left > 12 ? 'rest' : left > 0 ? 'almost' : 'ready', lastTxt: shortDate(a.last) + ' · ' + a.what };
  });
  return out;
}
const muscleStatus = () => Object.values(muscleState()).filter((m) => m.fig);
/* Series por músculo en la semana en curso */
function weekSetsDone() {
  const since = weekStart(), count = {};
  sessions().forEach((s) => { if (new Date(s.date) >= since) s.sets.forEach((x) => (EXERCISES[x.ex]?.m || []).forEach((m) => (count[m] = (count[m] || 0) + 1))); });
  return count;
}

/* ---------- readaptación después de una pausa ----------
   Si un músculo pasa más de 14 días sin entrenarse, los ejercicios donde es el principal vuelven
   escalonados desde la serie más pesada de antes de la pausa. Cuantos más días, más baja y más
   sesiones lleva volver. Se cuentan solo las sesiones de fuerza (las carreras no). */
const PAUSE_DAYS = 14;
const READAPT = [
  { upTo: 28, steps: [0.7, 0.85, 1] },
  { upTo: 56, steps: [0.6, 0.75, 0.9, 1] },
  { upTo: Infinity, steps: [0.5, 0.65, 0.8, 1] },
];
const midnight = (t) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
const calDays = (a, b) => Math.round((midnight(b) - midnight(a)) / DAY);
const pctTxt = (p) => Math.round(p * 100) + '%';
/* Momentos de las sesiones que entrenaron cada músculo, en orden. Se recalcula cuando cambian las sesiones. */
let musCache = { ref: null, len: -1, t: {} };
function muscleTimes() {
  const ss = sessions();
  if (musCache.ref === ss && musCache.len === ss.length) return musCache.t;
  const t = {};
  ss.forEach((s) => {
    const at = new Date(s.date).getTime(), seen = new Set();
    s.sets.forEach((x) => (EXERCISES[x.ex]?.m || []).forEach((m) => seen.add(m)));
    seen.forEach((m) => (t[m] || (t[m] = [])).push(at));
  });
  Object.values(t).forEach((a) => a.sort((x, y) => x - y));
  musCache = { ref: ss, len: ss.length, t };
  return t;
}
/* Readaptación del músculo `m` para una sesión en el momento `at` (por defecto, ahora).
   Devuelve null si no corresponde, o { days, step, steps, pct, from }: días de pausa, número de sesión
   de la vuelta (0 = la primera), escalones, porcentaje de hoy y la última sesión antes de la pausa. */
function readaptOf(m, at = Date.now()) {
  const t = (muscleTimes()[m] || []).filter((x) => x < at);
  if (!t.length) return null;
  const tier = (d) => READAPT.find((r) => d <= r.upTo);
  const now = calDays(t[t.length - 1], at);
  if (now > PAUSE_DAYS) { const r = tier(now); return { days: now, step: 0, steps: r.steps, pct: r.steps[0], from: t[t.length - 1] }; }
  for (let i = t.length - 1; i > 0 && t.length - i < 4; i--) {
    const d = calDays(t[i - 1], t[i]);
    if (d <= PAUSE_DAYS) continue;
    const r = tier(d), step = t.length - i;
    return step < r.steps.length ? { days: d, step, steps: r.steps, pct: r.steps[step], from: t[i - 1] } : null;
  }
  return null;
}
/* Serie más pesada del ejercicio la última vez que se hizo hasta `until` */
function heaviestBefore(exId, until) {
  for (let i = sessions().length - 1; i >= 0; i--) {
    const s = sessions()[i];
    if (new Date(s.date).getTime() > until) continue;
    const ks = s.sets.filter((x) => x.ex === exId).map((x) => x.kg || 0);
    if (ks.length) return { kg: Math.max(...ks), date: s.date };
  }
  return null;
}
const raSteps = (ra) => ra.steps.map(pctTxt).join(' → ');

/* ---------- aviso de recuperación al entrenar ---------- */
const mainM = (id) => EXERCISES[id].m[0];
const listJoin = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/* Músculos principales de una lista de ejercicios que siguen recuperándose (>12 h) o casi listos */
function recovOf(ids, ms) {
  const rest = new Set(), almost = new Set();
  ids.forEach((id) => { const m = ms[mainM(id)]; if (m.st === 'rest') rest.add(m.id); else if (m.st === 'almost') almost.add(m.id); });
  return { rest: [...rest].map((id) => ms[id]), almost: [...almost].map((id) => ms[id]) };
}
const dayIds = (d) => d.slots.map((s) => s.opts[0].id);
/* Otro día del plan con todos sus músculos principales listos; primero los que faltan en esta vuelta */
function betterDay(cur, ms) {
  const done = S().rot.done;
  const c = plan().days.filter((d) => d.id !== cur.id && d.slots.length).map((d) => ({ d, r: recovOf(dayIds(d), ms) })).filter((x) => !x.r.rest.length);
  c.sort((a, b) => (done.includes(a.d.id) - done.includes(b.d.id)) || a.r.almost.length - b.r.almost.length);
  return c[0] ? c[0].d : null;
}
/* Reemplazos para los ejercicios cuyo músculo principal no se recuperó (uno por ejercicio, sin repetir).
   Primero una alternativa del mismo bloque que no cargue músculos en recuperación; si no hay, uno del
   catálogo: músculos que no se entrenan en el resto del día, del tipo más parecido (básico, compuesto
   o aislamiento) y del músculo con menos series esta semana. */
function recoveryAlts(ms) {
  const c = S().current, n = c.day.slots.length, wk = weekSetsDone(), out = {};
  const eff = c.day.slots.map((_, i) => curOpt(i).id); // lo que queda en el día, con los reemplazos ya elegidos
  const fresh = (id) => EXERCISES[id].m.every((m) => ms[m].st === 'ready');
  const ratio = (id) => { const M = MUSCLES.find((m) => m.id === mainM(id)); return (wk[M.id] || 0) / M.target; };
  for (let ei = 0; ei < n; ei++) {
    const cur = curOpt(ei);
    if (ms[mainM(cur.id)].st !== 'rest' || exDone(ei)) continue;
    const same = c.day.slots[ei].opts.find((x) => x.id !== cur.id && fresh(x.id) && !eff.includes(x.id));
    let alt = null;
    if (same) alt = { id: same.id, sets: same.sets, reps: same.reps, rir: same.rir, rest: same.rest, why: 'mismo movimiento, sin cargar músculos en recuperación' };
    else {
      const today = new Set(eff.filter((_, i) => i !== ei).map(mainM));
      const score = (id) => (today.has(mainM(id)) ? 10 : 0) + Math.abs(PL.kind(id) - PL.kind(cur.id)) * 2 + ratio(id);
      const id = Object.keys(EXERCISES).filter((x) => !eff.includes(x) && fresh(x) && !EXERCISES[x].band).sort((a, b) => score(a) - score(b))[0];
      if (id) {
        const M = MUSCLES.find((m) => m.id === mainM(id));
        alt = { id, ...PL.defaultsFor(id), why: `trabaja un músculo recuperado (${M.n.toLowerCase()})` + (today.has(M.id) ? '' : ' que no está en el resto del día') };
      }
    }
    out[ei] = alt;
    if (alt) eff[ei] = alt.id;
  }
  return out;
}
let recAlts = {}; // sugerencias vigentes en la pantalla Entrenar
const mFill = { ready: '#469110', almost: '#E673AC', rest: '#660033' };
const R = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const E = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const figShapes = {
  front: [
    [null, '<circle cx="60" cy="20" r="13"/>' + R(54, 32, 12, 9, 3) + R(47, 70, 26, 34, 7) + R(21, 62, 12, 34, 6) + R(87, 62, 12, 34, 6) + R(18, 99, 11, 34, 5) + R(91, 99, 11, 34, 5) + R(45, 106, 30, 14, 6)],
    ['hombros', E(35, 52, 11, 10) + E(85, 52, 11, 10)],
    ['pecho', R(45, 44, 14.5, 24, 6) + R(60.5, 44, 14.5, 24, 6)],
    ['cuad', R(44, 122, 15, 54, 7) + R(61, 122, 15, 54, 7)],
    ['pant', R(46, 180, 11, 44, 5.5) + R(63, 180, 11, 44, 5.5)],
  ],
  back: [
    [null, '<circle cx="60" cy="20" r="13"/>' + R(54, 32, 12, 9, 3) + R(48, 94, 24, 10, 4) + R(21, 62, 12, 34, 6) + R(87, 62, 12, 34, 6) + R(18, 99, 11, 34, 5) + R(91, 99, 11, 34, 5)],
    ['hombros', E(35, 52, 11, 10) + E(85, 52, 11, 10)],
    ['espalda', R(44, 44, 32, 48, 9)],
    ['isquios', E(51, 114, 9.5, 9) + E(69, 114, 9.5, 9) + R(44, 126, 15, 50, 7) + R(61, 126, 15, 50, 7)],
    ['pant', R(46, 180, 11, 44, 5.5) + R(63, 180, 11, 44, 5.5)],
  ],
};
let selMuscle = null;
function renderRecovery() {
  const ms = muscleStatus();
  const info = (m) => `<b>${m.n}</b> · ${m.st === 'ready' ? 'listo para entrenar' : 'le faltan ' + m.left + ' h'} · ${esc(m.lastTxt)}`;
  $('#readyN').textContent = ms.filter((m) => m.st === 'ready').length;
  $('#recovDots').innerHTML = ms.map((m) => `<i style="background:${mFill[m.st]}${m.st === 'rest' ? ';box-shadow:inset 0 0 0 1px #B04A7E' : ''}"></i>`).join('');
  $('#recovList').innerHTML = ms.map((m) => {
    const pct = m.pct;
    const cls = { ready: 'p-ready', almost: 'p-almost', rest: 'p-rest' }[m.st];
    const ra = readaptOf(m.id), paused = ra && !ra.step;
    const raTxt = ra ? (paused ? ` · ${ra.days} días sin entrenar: la próxima sesión va al ${pctTxt(ra.pct)}` : ` · readaptación, sesión ${ra.step + 1} de ${ra.steps.length} al ${pctTxt(ra.pct)}`) : '';
    return `<div class="recov"><div><div>${m.n}</div><div class="sub" style="font-size:12.5px">${esc(m.lastTxt)}${raTxt}</div></div><span class="pill ${paused ? 'p-almost' : cls}">${paused ? 'readaptar' : m.st === 'ready' ? 'listo' : m.left + ' h más'}</span><div class="bar"><i style="width:${pct}%;background:${mFill[m.st]}"></i></div></div>`;
  }).join('');
  const fig = (view) => `<figure><svg viewBox="0 0 120 230" role="img" aria-label="Recuperación muscular, vista de ${view === 'front' ? 'frente' : 'espalda'}">` +
    figShapes[view].map(([id, shapes]) => {
      if (!id) return `<g fill="rgba(246,237,241,.08)">${shapes}</g>`;
      const m = ms.find((x) => x.id === id);
      return `<g class="mz${selMuscle === id ? ' sel' : ''}" data-m="${id}" fill="${mFill[m.st]}" ${m.st === 'rest' ? 'stroke="#B04A7E" stroke-width="1"' : ''} tabindex="0" role="button" aria-label="${m.n}">${shapes}</g>`;
    }).join('') + `</svg><figcaption>${view === 'front' ? 'Frente' : 'Espalda'}</figcaption></figure>`;
  $('#bodyMap').innerHTML = fig('front') + fig('back');
  if (selMuscle) $('#bodyInfo').innerHTML = info(ms.find((m) => m.id === selMuscle));
  else {
    const pending = ms.filter((m) => m.left > 0).sort((a, b) => a.left - b.left);
    $('#bodyInfo').innerHTML = pending.length ? info(pending[0]) + '<span class="sub"> · Tocá un músculo para ver su estado</span>' : 'Todo el cuerpo está recuperado.';
  }
  $$('.mz').forEach((g) => {
    const pick = () => { selMuscle = selMuscle === g.dataset.m ? null : g.dataset.m; renderRecovery(); };
    g.onclick = pick; g.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } };
  });
}
$('#recovToggle').onclick = () => {
  const p = $('#recovPanel'), open = p.hidden;
  p.hidden = !open; $('#recovToggle').setAttribute('aria-expanded', open);
  $('#recovHint').textContent = open ? 'Ocultar detalle' : 'Ver figura y detalle';
};

/* ---------- frase y canción del día ---------- */
const dayIdx = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY);
let qi = dayIdx % QUOTES.length, si = dayIdx % SONGS.length;
const showQuote = () => ($('#quoteTxt').textContent = QUOTES[qi]);
function showSong() {
  const [t, a] = SONGS[si], q = encodeURIComponent(t + ' ' + a);
  $$('.song-t').forEach((e) => (e.textContent = t));
  $$('.song-a').forEach((e) => (e.textContent = a));
  $$('.song-sp').forEach((e) => (e.href = 'https://open.spotify.com/search/' + q));
  $$('.song-yt').forEach((e) => (e.href = 'https://www.youtube.com/results?search_query=' + q));
}
$('#quoteNext').onclick = () => { qi = (qi + 1) % QUOTES.length; showQuote(); };
$('.song-next').onclick = () => { si = (si + 1) % SONGS.length; showSong(); };

/* ---------- HOY ---------- */
const wellHint = { s: ['Sueño', '1 muy mal · 5 excelente'], e: ['Energía', '1 sin energía · 5 a full'], m: ['Molestias', '1 ninguna · 5 mucho dolor'] };
function renderWellness() {
  const w = wellnessToday();
  $('#wellness').innerHTML = Object.entries(wellHint).map(([k, [lbl, hint]]) =>
    `<div class="row"><span>${lbl}<span class="hint">${hint}</span></span><div class="scale" role="group" aria-label="${lbl}">${[1, 2, 3, 4, 5].map((i) => `<button data-w="${k}" data-v="${i}" class="${i <= w[k] ? 'on' : ''}" aria-label="${lbl} ${i} de 5" aria-pressed="${i === w[k]}"></button>`).join('')}</div></div>`).join('');
  $$('[data-w]').forEach((b) => (b.onclick = () => {
    update((st) => { st.wellness[todayK()] = { ...wellnessToday(), [b.dataset.w]: +b.dataset.v }; });
    renderWellness();
  }));
  const s = readiness(), lv = rdLevel(s);
  $('#rdScore').textContent = s; $('#rdTitle').textContent = lv.t; $('#rdText').textContent = lv.x;
  $('#readyCard').className = 'ready ' + lv.cls;
}
function weekCount(offsetWeeks = 0) {
  const a = weekStart(); a.setDate(a.getDate() - 7 * offsetWeeks);
  const b = new Date(a); b.setDate(b.getDate() + 7);
  return sessions().filter((s) => { const d = new Date(s.date); return d >= a && d < b; }).length;
}
/* Semanas seguidas cumpliendo la meta: tantos entrenamientos como días tiene el plan */
function streak() {
  const goal = planDays();
  let n = weekCount(0) >= goal ? 1 : 0;
  for (let w = 1; w < 200 && weekCount(w) >= goal; w++) n++;
  return n;
}
let bwDraft = null;
function renderHoy() {
  const d = new Date();
  $('#todayLbl').textContent = WD_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
  showQuote(); showSong(); renderRecovery(); renderWellness();
  const cur = S().current;
  if (cur && cur.started) {
    const done = Object.values(cur.sets).filter((x) => x.done).length;
    $('#todayCta').innerHTML = `<span>Seguir entrenamiento · ${esc(cur.day.n)}<br><span style="font-weight:400;font-size:13px">${done} series hechas</span></span><span class="ms">play_arrow</span>`;
  } else {
    const P = nextDay(), first = P.slots[0] && P.slots[0].opts[0];
    const rec = recovOf(dayIds(P), muscleState()).rest;
    const sub = first ? `${EXERCISES[first.id].n} ${first.sets}×${first.reps} · ${P.slots.length} ejercicios` : 'Sin ejercicios todavía: armalo en Mi plan';
    $('#todayCta').innerHTML = `<span>Hoy toca: ${esc(P.n)}${P.t ? ' · ' + esc(P.t) : ''}<br><span style="font-weight:400;font-size:13px">${sub}${rec.length ? ' · ' + rec.map((m) => m.n.toLowerCase()).join(' y ') + ' en recuperación' : ''}</span></span><span class="ms">play_arrow</span>`;
  }
  $('#weekStat').textContent = weekCount() + '/' + planDays();
  $('#streakStat').textContent = streak();
  const t = mealTotals();
  $('#protStat').textContent = fmt(t.p, 0);
  $('#protGoalLbl').textContent = '/ ' + S().profile.goals.p + ' g prot.';
  if (bwDraft === null) bwDraft = currentBW();
  $('#bwVal').textContent = fmt(bwDraft);
  const b = S().bodyweight;
  $('#bwLast').textContent = b.length ? 'Último registro: ' + fmt(b[b.length - 1].kg) + ' kg · ' + shortDate(b[b.length - 1].d + 'T12:00') : 'Todavía no registraste tu peso.';
}
$('#bwMinus').onclick = () => { bwDraft = Math.round((bwDraft - 0.1) * 10) / 10; $('#bwVal').textContent = fmt(bwDraft); };
$('#bwPlus').onclick = () => { bwDraft = Math.round((bwDraft + 0.1) * 10) / 10; $('#bwVal').textContent = fmt(bwDraft); };
$('#bwSave').onclick = () => {
  update((st) => {
    const k = todayK(), i = st.bodyweight.findIndex((x) => x.d === k);
    if (i >= 0) st.bodyweight[i].kg = bwDraft; else st.bodyweight.push({ d: k, kg: bwDraft });
    st.bodyweight.sort((a, b) => (a.d < b.d ? -1 : 1));
    st.profile.bw = bwDraft;
  });
  toast('Peso guardado: ' + fmt(bwDraft) + ' kg');
  renderHoy();
};

/* ---------- ENTRENAR ---------- */
const kgLabel = (e, kg) => (e.band ? 'banda' : kg == null ? '—' : (e.added ? '+' : '') + fmt(kg) + ' kg' + (e.perHand ? ' c/u' : ''));
const incOf = (e) => (e.band ? 0 : e.perHand ? 2 : e.big ? 5 : 2.5);

/* Regla de progresión: todas las reps con el RIR objetivo → sube;
   faltaron 2+ reps en una serie → baja 10%; si no, repite. Después aplica el puntaje del día. */
function planOf(opt) {
  const e = EXERCISES[opt.id], last = lastSetsFor(opt.id), inc = incOf(e);
  let kg = null, tag = 'first', why, prev = null;
  if (!last) {
    const orm = S().profile.orm[opt.id];
    if (orm) {
      kg = roundTo(orm / (1 + (opt.reps + opt.rir) / 30), 2.5);
      why = `Primera vez con este ejercicio: calculé el peso desde tu 1RM de referencia (${fmt(orm)} kg) para ${opt.reps} repeticiones dejando ${opt.rir} en reserva.`;
    } else why = `Primera vez: elegí un peso con el que te sobren unas ${opt.rir} repeticiones. Desde la próxima sesión calculo la progresión.`;
  } else {
    prev = last.sets;
    const base = prev[0][0], repsTxt = prev.map((p) => p[1]).join(', ');
    const allReps = prev.every((p) => p[1] >= opt.reps), missed2 = prev.some((p) => p[1] <= opt.reps - 2);
    const avgRir = prev.reduce((a, p) => a + p[2], 0) / prev.length;
    kg = base; tag = 'same';
    if (e.band) why = allReps ? 'Completaste todas las repeticiones. Si te resultó fácil, pasá a una banda más dura.' : 'Repetí la misma banda hasta completar todas las repeticiones.';
    else if (missed2) { kg = roundTo(base * 0.9, e.perHand ? 2 : 2.5); tag = 'down'; why = `Te faltaron 2 o más repeticiones en alguna serie (${repsTxt}). Bajamos 10% para recuperar la técnica y volver a subir.`; }
    else if (allReps && avgRir >= opt.rir) { kg = base + inc; tag = 'up'; why = `La última vez (${shortDate(last.date)}) completaste ${prev.length}×${opt.reps} con ${kgLabel(e, base)} y te sobraron en promedio ${fmt(avgRir)} repeticiones (objetivo: ${opt.rir}). Subimos ${fmt(inc)} kg.`; }
    else if (!allReps) why = `La última vez no llegaste a ${opt.reps} en todas las series (${repsTxt}). Repetimos ${kgLabel(e, base)} hasta completarlas.`;
    else why = `Completaste todo, pero con poco margen: te sobraron ${fmt(avgRir)} repeticiones en promedio y el objetivo es ${opt.rir}. Repetimos el peso.`;
  }
  // readaptación: el músculo principal estuvo más de 14 días sin entrenarse
  const ra = !e.band && readaptOf(e.m[0]);
  if (ra) {
    const mn = MUSCLES.find((m) => m.id === e.m[0]).n.toLowerCase(), step = e.perHand ? 2 : 2.5;
    const head = (ra.step ? `Volviste a entrenar ${mn} después de ${ra.days} días sin hacerlo` : `Hace ${ra.days} días que no entrenás ${mn}`)
      + `: readaptación, sesión ${ra.step + 1} de ${ra.steps.length} (${raSteps(ra)}). `;
    const base = heaviestBefore(opt.id, ra.from);
    if (base && base.kg > 0) {
      kg = roundTo(base.kg * ra.pct, step);
      why = head + (ra.pct < 1 ? `Hoy ${pctTxt(ra.pct)} de tu serie más pesada antes de la pausa (${kgLabel(e, base.kg)}, ${shortDate(base.date)}).`
        : `Volvés a tu serie más pesada antes de la pausa (${kgLabel(e, base.kg)}, ${shortDate(base.date)}).`);
      tag = 'readapt';
      const inRa = last && new Date(last.date).getTime() > ra.from, lastKg = inRa ? last.sets[0][0] : 0;
      if (inRa && last.sets.some((p) => p[1] < opt.reps) && lastKg < kg) {
        // en la vuelta no completaste las repeticiones: repetís ese peso antes de seguir subiendo
        kg = lastKg; tag = 'same';
        why += ` Pero la última vez no completaste todas las repeticiones (${last.sets.map((p) => p[1]).join(', ')}): repetimos ${kgLabel(e, kg)} hasta completarlas.`;
      } else if (inRa && kg - lastKg > base.kg * 0.2) {
        // nunca más de 20% del peso de antes en una sesión (pasa si antes tuviste que repetir)
        kg = roundTo(lastKg + base.kg * 0.2, step);
        why += ` Pero como la última vez hiciste ${kgLabel(e, lastKg)}, subimos de a poco: como máximo 20% de tu peso de antes por sesión (${kgLabel(e, kg)}).`;
        ra.shown = kg / base.kg;
      }
    } else if (!last && kg > 0) {
      kg = roundTo(kg * ra.pct, step); tag = 'readapt';
      why = head + `Calculé el peso desde tu 1RM de referencia y lo bajé al ${pctTxt(ra.pct)}.`;
    } else if (!last) why = head + why;
  }
  const lv = rdLevel();
  if (lv.f < 1 && !e.band && kg > 0) {
    const adj = roundTo(kg * lv.f, e.perHand ? 2 : 2.5);
    if (adj < kg) { why += ` Tu puntaje de hoy es ${readiness()}: bajamos ${Math.round((1 - lv.f) * 100)}% (${kgLabel(e, kg)} → ${kgLabel(e, adj)}).`; kg = adj; if (tag !== 'readapt') tag = 'down'; }
  }
  return { kg, tag, why, prev, inc, ra: ra || null };
}
const tagTxt = (p) => (p.tag === 'readapt' ? 'readaptación ' + pctTxt(p.ra.shown || p.ra.pct) : p.tag === 'up' ? '+' + fmt(p.inc) + ' kg' : p.tag === 'down' ? 'baja' : p.tag === 'first' ? 'primera vez' : 'igual');

/* El entrenamiento en curso guarda una copia del día: si editás el plan, lo que ya empezaste no cambia */
const copyDay = (d) => JSON.parse(JSON.stringify(d));
const startDay = (d) => ({ planId: plan().id, day: copyDay(d), started: null, sel: d.slots.map(() => 0), alt: {}, sets: {} });
function ensureCurrent() {
  const c = S().current;
  if (c && c.started) return c;
  // sin empezar: se actualiza con el plan (cambió el plan, se borró el día o se editó)
  const p = plan(), d = c && c.planId === p.id && p.days.find((x) => x.id === c.day.id);
  if (!d) update((st) => { st.current = startDay(nextDay()); });
  else if (JSON.stringify(d) !== JSON.stringify(c.day)) update((st) => { st.current = startDay(d); });
  return S().current;
}
const curOpt = (ei) => { const c = S().current; return (c.alt && c.alt[ei]) || c.day.slots[ei].opts[c.sel[ei]]; };
const doneCount = () => Object.values(S().current.sets).filter((x) => x.done).length;
const exDone = (ei) => Object.entries(S().current.sets).some(([k, v]) => k.startsWith(ei + '-') && v.done);
function switchDay(id) {
  const c = S().current;
  if (id === c.day.id) return;
  if (doneCount()) { toast('Ya empezaste este día. Terminalo o descartalo para cambiar.'); return; }
  const d = plan().days.find((x) => x.id === id);
  update((st) => { st.current = startDay(d); });
  renderEntrenar(); $('#main').scrollTop = 0;
}

let clockT = null;
function renderEntrenar() {
  const c = ensureCurrent(), P = c.day, p = plan(), nd = nextDay(), ms = muscleState();
  $('#wkTitle').textContent = P.n + (P.t ? ' · ' + P.t : '');
  $('#planLbl').textContent = p.name;
  $('#dayPick').innerHTML = p.days.map((d, i) => {
    const rest = recovOf(dayIds(d), ms).rest.length, isNext = d.id === nd.id;
    return `<button class="daychip" data-day="${d.id}" aria-pressed="${d.id === P.id}"><span class="dn">${i + 1}</span><span class="dt">${esc(d.n)}</span>${isNext ? '<span class="dnext">toca</span>' : ''}${rest ? '<i class="ddot" aria-hidden="true"></i><span class="vh">, músculos en recuperación</span>' : ''}</button>`;
  }).join('');
  $$('[data-day]').forEach((b) => (b.onclick = () => switchDay(b.dataset.day)));
  // aviso del día: músculos principales que todavía se recuperan
  const rb = $('#recBanner'), r = recovOf(P.slots.map((_, i) => curOpt(i).id), ms);
  rb.hidden = !(!c.started && !doneCount() && r.rest.length);
  if (!rb.hidden) {
    const alt = betterDay(P, ms), names = r.rest.map((m) => m.n.toLowerCase());
    rb.innerHTML = `<span class="ms">bedtime</span><span><b>${cap(listJoin(names))}: en recuperación.</b> ${r.rest.length === 1 ? 'Faltan ' + r.rest[0].left + ' h' : 'Faltan ' + listJoin(r.rest.map((m) => m.left + ' h para ' + m.n.toLowerCase()))}. `
      + (alt ? `Hoy te conviene <b>${esc(alt.n)}</b>, que tiene todos sus músculos listos.<br><button class="bannerbtn" data-goday="${alt.id}">Hacer ${esc(alt.n)} hoy</button>` : 'Ningún otro día del plan está listo del todo: usá los reemplazos que te sugiero en cada ejercicio.') + '</span>';
    const gb = rb.querySelector('[data-goday]'); if (gb) gb.onclick = () => switchDay(gb.dataset.goday);
  }
  // aviso de readaptación: músculos principales del día que vuelven de una pausa
  const raB = $('#raBanner'), raL = [];
  new Set(P.slots.map((_, i) => mainM(curOpt(i).id))).forEach((m) => { const ra = readaptOf(m); if (ra) raL.push({ mu: ms[m], ra }); });
  raB.hidden = !(raL.length && !c.started && !doneCount());
  if (!raB.hidden) raB.innerHTML = '<span class="ms">trending_down</span><span><b>Readaptación.</b> '
    + raL.map(({ mu, ra }) => `${mu.n}: ${ra.step ? `sesión ${ra.step + 1} de ${ra.steps.length} después de ${ra.days} días sin entrenar` : `${ra.days} días sin entrenar`}, hoy al ${pctTxt(ra.pct)}.`).join(' ')
    + ' Los pesos sugeridos ya están bajados; si los querés cambiar, escribí otro peso en la serie.</span>';
  $('#exList').innerHTML = P.slots.length ? P.slots.map((_, ei) => `<div class="ex" id="ex${ei}"></div>`).join('')
    : `<p class="empty">Este día no tiene ejercicios todavía. <button class="linkbtn" id="emptyEdit">Agregalos en Mi plan</button></p>`;
  if (!P.slots.length) { $('#setsTotal').textContent = 0; $('#emptyEdit').onclick = () => openPlan({ mode: 'day', dayId: P.id }); }
  recAlts = recoveryAlts(ms);
  P.slots.forEach((_, ei) => renderEx(ei, ms));
  $('#finishBtn').hidden = $('#discardBtn').hidden = !P.slots.length;
  updateWorkoutStats();
  const s = readiness(), lv = rdLevel(s), bn = $('#rdBanner');
  bn.hidden = lv.f === 1; bn.className = 'rdbanner ' + lv.cls;
  bn.innerHTML = `<span class="ms">monitor_heart</span><span><b>Puntaje ${s} · ${lv.t}.</b> ${lv.x}</span>`;
  const fb = S().lastFeedback;
  $('#lastFb').hidden = !(fb && fb.d === todayK() && !c.started);
  if (fb) $('#lastFb').innerHTML = `<div class="eyebrow" style="color:inherit"><span>Entrenamiento guardado</span><span>${esc(fb.head)}</span></div>${fb.lines.map((t) => `<p>${esc(t)}</p>`).join('')}`;
  clearInterval(clockT);
  const tick = () => ($('#wkClock').textContent = c.started ? mmss((Date.now() - c.started) / 1000) : '00:00');
  tick(); clockT = setInterval(tick, 1000);
  showSong();
}
/* Avisos de recuperación de un ejercicio: bordó si al músculo principal le faltan más de 12 h
   (con un reemplazo de un toque), nota rosa si le faltan menos, y nota por los secundarios */
function recovNote(ei, opt, ms) {
  if (exDone(ei)) return '';
  const [m0, ...sec] = EXERCISES[opt.id].m.map((m) => ms[m]);
  let h = '';
  if (m0.st === 'rest') {
    const alt = recAlts[ei];
    h += `<div class="recwarn"><span class="ms">bedtime</span><div><b>${m0.n}: en recuperación.</b> Faltan ${m0.left} h (${esc(m0.lastTxt)}). `
      + (alt ? `Te sugiero <b>${EXERCISES[alt.id].n}</b> ${alt.sets}×${alt.reps}: ${esc(alt.why)}.</div><button data-recalt="${ei}">Cambiar</button>`
        : 'No encontré un reemplazo con los músculos listos: bajá el peso o dejá más repeticiones en reserva.</div>') + '</div>';
  } else if (m0.st === 'almost') h += `<p class="recnote">${m0.n}: faltan ${m0.left} h para la recuperación completa. Podés hacerlo; si lo sentís pesado, repetí el peso.</p>`;
  const secR = sec.filter((m) => m.st !== 'ready');
  if (secR.length) h += `<p class="recnote dim">También carga ${listJoin(secR.map((m) => `${m.n.toLowerCase()} (faltan ${m.left} h de recuperación)`))}.</p>`;
  return h;
}
function renderEx(ei, ms = muscleState()) {
  const c = S().current, slot = c.day.slots[ei], opt = curOpt(ei), e = EXERCISES[opt.id], plan0 = EXERCISES[slot.opts[0].id], pl = planOf(opt);
  const alt = c.alt && c.alt[ei];
  $('#setsTotal').textContent = c.day.slots.reduce((a, _, i) => a + curOpt(i).sets, 0);
  const val = (si, k, def) => { const v = c.sets[ei + '-' + si]; return v && v[k] != null && v[k] !== '' ? v[k] : def; };
  const altM = alt && MUSCLES.find((m) => m.id === mainM(alt.id));
  $('#ex' + ei).innerHTML = `
    <div class="slot-lbl">${ei + 1} · ${alt ? altM.n + ' <span>· en lugar de ' + slot.p.toLowerCase() + '</span>' : slot.p + ' <span>· ' + slot.m + '</span>'}</div>
    <div class="ex-head">
      <button class="ex-pick" aria-expanded="false" aria-controls="pick${ei}"><span class="ex-name">${e.n}</span><span class="ms">expand_more</span></button>
      <button class="tipbtn" aria-expanded="false" aria-controls="tip${ei}" aria-label="Consejo de técnica"><span class="ms">lightbulb</span></button>
    </div>
    <div class="picker" id="pick${ei}" role="listbox" aria-label="Elegir ejercicio de ${slot.p.toLowerCase()}" hidden>
      <div class="picker-h">Ejercicios similares · ${slot.m}</div>
      ${slot.opts.map((o, oi) => `
        <button class="opt" role="option" aria-selected="${!alt && oi === c.sel[ei]}" data-opt="${oi}">
          <span class="opt-main"><span class="opt-n">${EXERCISES[o.id].n}</span><span class="opt-why">${oi === 0 ? 'Del plan de hoy' : o.why || ''}</span></span>
          <span class="opt-side">${o.rec ? '<span class="pill p-almost">Recomendado</span>' : ''}<span class="opt-sch">${o.sets}×${o.reps} · ${kgLabel(EXERCISES[o.id], planOf(o).kg)}</span></span>
          <span class="ms opt-chk" aria-hidden="true">${!alt && oi === c.sel[ei] ? 'check_circle' : 'radio_button_unchecked'}</span>
        </button>`).join('')}
    </div>
    ${alt ? `<div class="swapnote"><span class="ms" style="font-size:18px">bedtime</span><span>Reemplaza a <b>${plan0.n}</b> por recuperación de ${MUSCLES.find((m) => m.id === mainM(slot.opts[0].id)).n.toLowerCase()}. Queda anotado en el historial.</span><button data-back="1">Volver al plan</button></div>`
      : c.sel[ei] ? `<div class="swapnote"><span class="ms" style="font-size:18px">swap_horiz</span><span>Reemplaza a <b>${plan0.n}</b>. Sigue trabajando ${slot.m}.</span><button data-back="1">Volver al plan</button></div>` : ''}
    ${recovNote(ei, opt, ms)}
    <div class="ex-meta">${opt.sets}×${opt.reps} · RIR ${opt.rir} · descanso ${mss(opt.rest)}</div>
    <div class="tip" id="tip${ei}" hidden>${e.tip}</div>
    <button class="why" aria-expanded="false" aria-controls="why${ei}">
      <span class="ms" style="font-size:16px;color:var(--pink)">auto_awesome</span>
      <span>Hoy: <b>${kgLabel(e, pl.kg)}</b></span><span class="tag tag-${pl.tag === 'first' ? 'same' : pl.tag}">${tagTxt(pl)}</span><span class="why-q">¿Por qué?</span>
    </button>
    <div class="rule" id="why${ei}" hidden>
      <p>${pl.why}</p>
      <p class="rule-base">Regla: si completás todas las series con el RIR objetivo, sube ${e.band ? 'la banda' : fmt(pl.inc) + ' kg'}. Si te falta alguna repetición, repetís el peso. Si te faltan 2 o más en una serie, baja 10%.${pl.ra ? ' Readaptación: con más de 14 días sin entrenar el músculo, bajás 30% (hasta 4 semanas), 40% (hasta 8) o 50% (más de 8) y volvés escalonado a tu peso de antes.' : ''}</p>
    </div>
    <div class="sets">
      <span class="h" style="text-align:center">#</span><span class="h">Anterior</span><span class="h">${e.band ? 'banda' : e.added ? 'lastre' : 'kg'}</span><span class="h">reps</span><span class="h">RIR</span><span></span>
      ${Array.from({ length: opt.sets }, (_, si) => {
        const k = ei + '-' + si, p = pl.prev ? pl.prev[si] || pl.prev[pl.prev.length - 1] : null, done = c.sets[k] && c.sets[k].done;
        const prevTxt = p ? (e.band ? 'banda' : (e.added ? '+' : '') + fmt(p[0])) + '×' + p[1] : '–';
        const st = done ? (c.sets[k].pr ? 'background:var(--green);border-color:var(--green);color:#fff' : 'background:var(--forest);border-color:var(--forest);color:var(--forest-ink)') : '';
        const inSt = done ? 'background:transparent;color:var(--muted)' : '';
        return `
        <span class="n">${si + 1}</span>
        <span class="prevset${p && p[1] < opt.reps ? ' short' : ''}">${prevTxt}</span>
        <input id="w${k}" data-k="${k}" data-f="kg" inputmode="decimal" style="${inSt}" value="${e.band ? 'media' : val(si, 'kg', pl.kg == null ? '' : fmt(pl.kg))}" placeholder="kg" aria-label="${e.n} serie ${si + 1} kilos">
        <input id="r${k}" data-k="${k}" data-f="reps" inputmode="numeric" style="${inSt}" value="${val(si, 'reps', opt.reps)}" aria-label="${e.n} serie ${si + 1} repeticiones">
        <input id="i${k}" data-k="${k}" data-f="rir" inputmode="numeric" style="${inSt}" value="${val(si, 'rir', opt.rir)}" aria-label="${e.n} serie ${si + 1} RIR">
        <button class="chk${done ? ' isdone' : ''}" style="${st}" data-e="${ei}" data-s="${si}" aria-label="Completar serie ${si + 1}" aria-pressed="${!!done}"><span class="ms">check</span></button>`;
      }).join('')}
    </div>`;
  const box = $('#ex' + ei);
  const toggle = (btn, id) => { const t = $('#' + id); t.hidden = !t.hidden; btn.setAttribute('aria-expanded', !t.hidden); };
  box.querySelector('.why').onclick = (ev) => toggle(ev.currentTarget, 'why' + ei);
  box.querySelector('.tipbtn').onclick = (ev) => toggle(ev.currentTarget, 'tip' + ei);
  box.querySelector('.ex-pick').onclick = (ev) => toggle(ev.currentTarget, 'pick' + ei);
  box.querySelectorAll('.opt').forEach((b) => (b.onclick = () => swapEx(ei, +b.dataset.opt)));
  const back = box.querySelector('[data-back]'); if (back) back.onclick = () => swapEx(ei, 0);
  const ra = box.querySelector('[data-recalt]'); if (ra) ra.onclick = () => acceptAlt(ei);
  box.querySelectorAll('input[data-k]').forEach((inp) => (inp.onchange = () => {
    update((st) => { const k = inp.dataset.k; st.current.sets[k] = { ...(st.current.sets[k] || {}), [inp.dataset.f]: inp.value }; });
  }));
  box.querySelectorAll('.chk').forEach((b) => (b.onclick = () => toggleSet(+b.dataset.e, +b.dataset.s)));
}
const clearExSets = (st, ei) => Object.keys(st.current.sets).forEach((k) => { if (k.startsWith(ei + '-')) delete st.current.sets[k]; });
function swapEx(ei, oi) {
  const c = S().current, hadAlt = !!(c.alt && c.alt[ei]);
  if (oi === c.sel[ei] && !hadAlt) { renderEx(ei); return; }
  const from = EXERCISES[curOpt(ei).id].n, hadDone = exDone(ei);
  update((st) => { st.current.sel[ei] = oi; if (st.current.alt) delete st.current.alt[ei]; clearExSets(st, ei); });
  recAlts = recoveryAlts(muscleState());
  renderEx(ei); updateWorkoutStats();
  const to = EXERCISES[curOpt(ei).id].n;
  toast((oi === 0 ? 'Volviste a ' + to : 'Cambiaste ' + from + ' por ' + to) + (hadDone ? '. Las series de este ejercicio se reiniciaron' : ''));
}
/* Acepta el reemplazo sugerido por recuperación */
function acceptAlt(ei) {
  const alt = recAlts[ei];
  if (!alt) return;
  const from = EXERCISES[curOpt(ei).id].n;
  update((st) => { st.current.alt = { ...(st.current.alt || {}), [ei]: alt }; clearExSets(st, ei); });
  renderEntrenar();
  toast('Cambiaste ' + from + ' por ' + EXERCISES[alt.id].n);
}
function toggleSet(ei, si) {
  const k = ei + '-' + si, c = S().current, opt = curOpt(ei), e = EXERCISES[opt.id];
  const on = !(c.sets[k] && c.sets[k].done);
  const kg = e.band ? 0 : num($('#w' + k).value), reps = parseInt($('#r' + k).value, 10), rir = parseInt($('#i' + k).value, 10);
  if (on && (kg == null || !(reps > 0))) { toast(kg == null ? 'Cargá el peso de la serie' : 'Cargá las repeticiones'); return; }
  let pr = false;
  if (on && !e.added && !e.band && kg > 0) {
    const est = e1rm(kg, reps, Number.isFinite(rir) ? rir : 0);
    const sessBest = Math.max(0, ...Object.entries(c.sets).filter(([kk, v]) => kk !== k && v.done && v.ex === opt.id).map(([, v]) => e1rm(v.kgN, v.repsN, v.rirN)));
    const hist = bestE1RM(opt.id).best;
    if (hist > 0 && est > Math.max(hist, sessBest)) { pr = true; toast('Récord: ' + e.n + ' · 1RM estimado ' + fmt(est) + ' kg', true); beep(1320, 0.15, 2); buzz([80, 60, 80]); }
  }
  const first = on && !c.started;
  update((st) => {
    st.current.sets[k] = { ...(st.current.sets[k] || {}), kg: $('#w' + k).value, reps: String(reps || ''), rir: String(Number.isFinite(rir) ? rir : ''), done: on, pr, ex: opt.id, kgN: kg, repsN: reps, rirN: Number.isFinite(rir) ? rir : opt.rir };
    if (on && !st.current.started) st.current.started = Date.now();
  });
  if (on) { startRest(opt.rest); keepAwake(true); }
  renderEx(ei); updateWorkoutStats();
  if (first) renderEntrenar();
}
function updateWorkoutStats() {
  const c = S().current; let n = 0, vol = 0;
  Object.values(c.sets).forEach((v) => {
    if (!v.done) return; n++;
    const e = EXERCISES[v.ex];
    if (e && !e.added && !e.band) vol += (v.kgN || 0) * (v.repsN || 0) * (e.perHand ? 2 : 1);
  });
  $('#setsDone').textContent = n; $('#volTxt').textContent = fmt(vol, 0);
}

/* descanso entre series: cuenta contra una hora de fin, así no se atrasa con la pantalla apagada */
let restEnd = 0, restT = null;
function startRest(sec) {
  restEnd = Date.now() + sec * 1000; $('#rest').hidden = screen !== 'entrenar';
  clearInterval(restT);
  bgHold('rest', true);
  const tick = () => {
    const left = Math.ceil((restEnd - Date.now()) / 1000);
    $('#restClock').textContent = mss(left);
    if (left <= 0) {
      clearInterval(restT); restEnd = 0; $('#rest').hidden = true;
      beep(988, 0.2, 3); buzz([200, 100, 200]); toast('Descanso terminado. Siguiente serie');
      notify('Descanso terminado', 'Siguiente serie');
      bgHold('rest', false);
    }
  };
  tick(); restT = setInterval(tick, 500);
}
$('#restPlus').onclick = () => { restEnd += 30e3; };
$('#restSkip').onclick = () => { restEnd = 0; clearInterval(restT); $('#rest').hidden = true; bgHold('rest', false); };

/* encuesta al terminar */
const survey = { fat: 'Media', joint: 'No', perf: 'Igual' };
const surveyQ = [
  ['fat', '¿Cuánta fatiga sentís?', ['Baja', 'Media', 'Alta']],
  ['joint', '¿Te molestó alguna articulación?', ['No', 'Leve', 'Sí']],
  ['perf', '¿Cómo rendiste comparado con la última vez?', ['Peor', 'Igual', 'Mejor']],
];
function renderSurvey() {
  $('#svBody').innerHTML = surveyQ.map(([k, q, opts]) => `<div class="svq"><p>${q}</p><div class="seg" role="group" aria-label="${q}">${opts.map((o) => `<button data-sv="${k}" data-v="${o}" aria-pressed="${survey[k] === o}">${o}</button>`).join('')}</div></div>`).join('');
  $$('[data-sv]').forEach((b) => (b.onclick = () => { survey[b.dataset.sv] = b.dataset.v; renderSurvey(); }));
}
function openSurvey(open) { $('#survey').hidden = !open; $('#sheetBg').hidden = !open; if (open) renderSurvey(); }
$('#svX').onclick = () => openSurvey(false);
$('#finishBtn').onclick = () => { if (!doneCount()) { toast('Completá al menos una serie'); return; } openSurvey(true); };
$('#svSave').onclick = () => {
  const c = S().current, lines = [];
  if (survey.joint === 'Sí') lines.push('Marcaste dolor articular: la próxima vez probá reemplazos más suaves (landmine press, barra hexagonal) y dejá 3 repeticiones en reserva. Si el dolor sigue, consultá a un profesional.');
  else if (survey.joint === 'Leve') lines.push('Molestia leve: sumá 5 minutos de movilidad y face pull antes de los press.');
  if (survey.fat === 'Alta' && survey.perf === 'Peor') lines.push('Fatiga alta y rendimiento peor: considerá una semana de descarga (mismo programa con 60% del peso).');
  else if (survey.fat === 'Alta') lines.push('Fatiga alta: la próxima sesión repetí los pesos en lugar de subir.');
  else if (survey.perf === 'Mejor') lines.push('Rendiste mejor: seguimos con la progresión normal.');
  else lines.push(survey.joint === 'No' ? 'Todo en orden: seguimos con la progresión normal.' : 'En los ejercicios que no molestan, seguimos con la progresión normal.');
  const sets = Object.entries(c.sets).filter(([, v]) => v.done).sort(([a], [b]) => {
    const [ae, as] = a.split('-').map(Number), [be, bs] = b.split('-').map(Number); return ae - be || as - bs;
  }).map(([k, v]) => ({ ex: v.ex, slot: +k.split('-')[0], kg: v.kgN, reps: v.repsN, rir: v.rirN }));
  const n = sets.length, vol = $('#volTxt').textContent, p = plan();
  // reemplazos respecto del plan, para el historial
  const swaps = c.day.slots.map((s, i) => ({ slot: i, from: s.opts[0].id, to: curOpt(i).id, reason: c.alt && c.alt[i] ? 'recuperacion' : 'alternativa' }))
    .filter((x) => x.from !== x.to && sets.some((y) => y.slot === x.slot));
  const recSw = swaps.filter((x) => x.reason === 'recuperacion');
  if (recSw.length) lines.push('Por recuperación cambiaste ' + recSw.map((x) => EXERCISES[x.from].n + ' por ' + EXERCISES[x.to].n).join(' y ') + '. Queda anotado en el historial.');
  update((st) => {
    st.sessions.push({ id: uid(), date: new Date().toISOString(), planId: c.planId, planName: p && p.id === c.planId ? p.name : (st.plans.find((x) => x.id === c.planId) || {}).name || '', dayId: c.day.id, dayName: c.day.n, dur: Math.round((Date.now() - (c.started || Date.now())) / 1000), sets, swaps, survey: { ...survey } });
    // rotación: el día queda hecho en esta vuelta; cuando están todos, empieza otra
    if (c.planId === st.activePlan) {
      const ids = p.days.map((d) => d.id);
      st.rot.done = [...st.rot.done.filter((id) => ids.includes(id) && id !== c.day.id), c.day.id];
      if (ids.every((id) => st.rot.done.includes(id))) st.rot.done = [];
    }
    st.rot.pin = null;
    st.current = null;
    st.lastFeedback = { d: todayK(), head: n + (n === 1 ? ' serie' : ' series') + ' · ' + vol + ' kg', lines };
  });
  openSurvey(false); keepAwake(false); clearInterval(clockT); clockT = null;
  toast('Entrenamiento guardado');
  renderEntrenar(); $('#lastFb').hidden = false; $('#main').scrollTop = 0;
};
let discardArm = 0;
$('#discardBtn').onclick = () => {
  if (Date.now() - discardArm > 4000) { discardArm = Date.now(); $('#discardBtn').textContent = 'Tocá de nuevo para descartar'; setTimeout(() => ($('#discardBtn').textContent = 'Descartar entrenamiento'), 4000); return; }
  update((st) => { st.current = null; });
  keepAwake(false); $('#discardBtn').textContent = 'Descartar entrenamiento'; toast('Entrenamiento descartado'); renderEntrenar();
};

/* ---------- CORRER ---------- */
const run = { mode: 'free', on: false, elapsed: 0, dist: 0, laps: [], last: 0, t: null, cfg: { fast: 60, easy: 120, rounds: 6 }, phase: 'fast', phaseLeft: 60, round: 1, lapStart: 0, lapDist: 0, kmSpoken: 0 };
let watchId = null, lastPos = null;
function setGps(state, txt) {
  const icon = { off: 'gps_off', wait: 'gps_not_fixed', ok: 'gps_fixed', weak: 'gps_not_fixed' }[state];
  $('#gpsPill').innerHTML = `<span class="ms" style="font-size:14px">${icon}</span><span>${txt}</span>`;
  $('#gpsPill').className = 'pill ' + (state === 'ok' ? 'p-ready' : state === 'weak' || state === 'wait' ? 'p-almost' : 'p-line');
}
const hav = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371e3 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
function gpsStart() {
  if (!('geolocation' in navigator)) { setGps('off', 'Sin GPS'); return; }
  if (watchId != null) return;
  setGps('wait', 'Buscando GPS…');
  watchId = navigator.geolocation.watchPosition((p) => {
    const { latitude: lat, longitude: lon, accuracy } = p.coords;
    setGps(accuracy <= 25 ? 'ok' : 'weak', 'GPS ±' + Math.round(accuracy) + ' m');
    if (!run.on) { lastPos = null; return; }
    if (accuracy > 30) return;
    const pt = { lat, lon, t: p.timestamp };
    if (!lastPos) { lastPos = pt; return; }
    const d = hav(lastPos, pt), dt = (pt.t - lastPos.t) / 1000;
    if (d >= 3 && dt > 0 && d / dt < 12) { run.dist += d; lastPos = pt; }
  }, (err) => {
    setGps('off', err.code === 1 ? 'Permiso de GPS denegado' : 'GPS sin señal');
    if (err.code === 1) toast('Sin permiso de ubicación: se mide solo el tiempo');
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}
function gpsStop() { if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; lastPos = null; setGps('off', 'GPS apagado'); }
function speak(text) {
  if (!S().settings.voice || !('speechSynthesis' in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'es-AR'; speechSynthesis.speak(u); } catch (e) {}
}
function setMode(m) {
  if (!setMode.skipReset && (run.on || run.elapsed)) resetRun();
  run.mode = m;
  $('#modeFree').setAttribute('aria-pressed', m === 'free'); $('#modeInt').setAttribute('aria-pressed', m === 'int');
  $('#intCfg').hidden = m !== 'int';
  $('#runLap').textContent = m === 'int' ? 'Saltar' : 'Vuelta';
  $('#lapsLbl').textContent = m === 'int' ? 'rondas' : 'vueltas';
  paintRun();
}
$('#modeFree').onclick = () => setMode('free');
$('#modeInt').onclick = () => setMode('int');
$$('[data-cfg]').forEach((b) => (b.onclick = () => {
  const k = b.dataset.cfg, d = +b.dataset.d;
  run.cfg[k] = k === 'rounds' ? Math.min(20, Math.max(1, run.cfg[k] + d)) : Math.min(600, Math.max(15, run.cfg[k] + d));
  if (!run.elapsed) run.phaseLeft = run.cfg.fast;
  $('#cfgFast').textContent = mss(run.cfg.fast); $('#cfgEasy').textContent = mss(run.cfg.easy); $('#cfgRounds').textContent = run.cfg.rounds;
  paintRun();
}));
function tick() {
  const now = Date.now(), dt = (now - run.last) / 1000; run.last = now;
  run.elapsed += dt;
  if (run.mode === 'int') {
    run.phaseLeft -= dt;
    // Si la app estuvo frenada (celular bloqueado), avanza todas las fases vencidas
    // de una vez y avisa solo la última.
    let changes = 0;
    while (run.phaseLeft <= 0 && run.phase !== 'done' && changes < 100) {
      const carry = run.phaseLeft;
      nextPhase(true);
      if (run.phase !== 'done') run.phaseLeft += carry;
      changes++;
    }
    if (changes) announcePhase();
  }
  const km = Math.floor(run.dist / 1000);
  if (km > run.kmSpoken) {
    run.kmSpoken = km;
    const pace = run.elapsed / (run.dist / 1000);
    speak(`Kilómetro ${km}. Ritmo ${Math.floor(pace / 60)} minutos ${Math.round(pace % 60)} segundos.`);
  }
  saveRunSnap();
  paintRun();
}
/* quiet: cambia de fase sin avisar (el aviso lo da announcePhase) */
function nextPhase(quiet) {
  if (run.phase === 'fast') { run.phase = 'easy'; run.phaseLeft = run.cfg.easy; }
  else if (run.round >= run.cfg.rounds) { run.phase = 'done'; run.on = false; clearInterval(run.t); }
  else { run.round++; run.phase = 'fast'; run.phaseLeft = run.cfg.fast; }
  if (!quiet) announcePhase();
}
function announcePhase() {
  if (run.phase === 'done') {
    beep(1320, 0.3, 3); buzz([200, 100, 200, 100, 200]); speak('Intervalos completos');
    toast('Intervalos completos: ' + fmt(run.dist / 1000, 2) + ' km');
    notify('Intervalos completos', fmt(run.dist / 1000, 2) + ' km en ' + mmss(run.elapsed));
  } else if (run.phase === 'easy') {
    beep(660, 0.25, 2); buzz([300]); speak('Suave');
    notify('Suave · ' + mss(run.cfg.easy), 'Ronda ' + run.round + ' de ' + run.cfg.rounds);
  } else {
    beep(1046, 0.2, 2); buzz([150, 80, 150]); speak('Rápido');
    notify('Rápido · ' + mss(run.cfg.fast), 'Ronda ' + run.round + ' de ' + run.cfg.rounds);
  }
  paintRun();
}

/* Guarda la carrera en curso: si Android cierra la app en segundo plano, se recupera al volver */
const SNAP = 'carga:run';
let snapAt = 0;
function saveRunSnap(force) {
  if (!force && Date.now() - snapAt < 3000) return;
  snapAt = Date.now();
  try {
    if (!run.elapsed && !run.on) { localStorage.removeItem(SNAP); return; }
    const { t, ...rest } = run;
    localStorage.setItem(SNAP, JSON.stringify({ ...rest, savedAt: Date.now(), lastPos }));
  } catch (e) {}
}
function restoreRunSnap() {
  try {
    const s = JSON.parse(localStorage.getItem(SNAP) || 'null');
    if (!s || Date.now() - s.savedAt > 6 * H) { localStorage.removeItem(SNAP); return; }
    const wasOn = s.on;
    Object.assign(run, s, { on: false, t: null });
    delete run.savedAt; delete run.lastPos;
    if (wasOn) {
      // El tiempo siguió corriendo: el primer tick descuenta todo lo que pasó desde
      // el último guardado (tiempo total y fases de intervalos).
      run.on = true; run.last = s.last;
      lastPos = s.lastPos; // el GPS completa el tramo en línea recta
      run.t = setInterval(tick, 250); gpsStart();
    }
    setMode.skipReset = true; setMode(run.mode); setMode.skipReset = false;
    toast('Recuperé tu carrera en curso');
  } catch (e) {}
}
function paintRun() {
  $('#runClock').textContent = mmss(run.elapsed);
  $('#runDist').textContent = (run.dist / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pace = run.dist > 50 ? run.elapsed / (run.dist / 1000) : 0;
  $('#runPace').textContent = pace ? Math.floor(pace / 60) + "'" + String(Math.round(pace % 60)).padStart(2, '0') + '"' : "–'––\"";
  const card = $('#runCard'); card.classList.remove('fast', 'easy');
  if (run.mode === 'int') {
    $('#runLaps').textContent = run.round + '/' + run.cfg.rounds;
    if (run.phase === 'done') { $('#phaseLbl').textContent = 'Terminado'; $('#phaseLeft').textContent = ''; }
    else if (run.on || run.elapsed) {
      card.classList.add(run.phase);
      $('#phaseLbl').textContent = (run.phase === 'fast' ? 'Rápido' : 'Suave') + ' · ronda ' + run.round;
      $('#phaseLeft').textContent = 'quedan ' + mss(Math.ceil(run.phaseLeft));
    } else { $('#phaseLbl').textContent = run.cfg.rounds + ' × (' + mss(run.cfg.fast) + ' rápido / ' + mss(run.cfg.easy) + ' suave)'; $('#phaseLeft').textContent = ''; }
  } else {
    $('#runLaps').textContent = run.laps.length;
    $('#phaseLbl').textContent = run.on ? 'Corriendo' : run.elapsed ? 'En pausa' : 'Listo para empezar';
    $('#phaseLeft').textContent = '';
  }
  $('#runStart').textContent = run.on ? 'Pausa' : run.elapsed ? 'Seguir' : 'Empezar';
}
function toggleRun() {
  if (run.phase === 'done') return;
  run.on = !run.on;
  if (run.on) {
    gpsStart(); keepAwake(true); bgHold('run', true);
    run.last = Date.now(); run.t = setInterval(tick, 250);
    if (!run.elapsed) { beep(1046, 0.15); if (run.mode === 'int') speak('Rápido'); }
  } else { clearInterval(run.t); lastPos = null; }
  saveRunSnap(true);
  paintRun(); mediaTick();
}
function resetRun() {
  clearInterval(run.t);
  bgHold('run', false);
  try { localStorage.removeItem(SNAP); } catch (e) {}
  if (run.elapsed > 30) {
    const rec = { id: uid(), date: new Date().toISOString(), mode: run.mode, dur: Math.round(run.elapsed), dist: Math.round(run.dist), laps: run.laps.map((l) => ({ t: Math.round(l.t), d: Math.round(l.d) })) };
    update((st) => { st.runs.push(rec); });
    toast('Carrera guardada: ' + fmt(run.dist / 1000, 2) + ' km en ' + mmss(run.elapsed));
  }
  Object.assign(run, { on: false, elapsed: 0, dist: 0, laps: [], phase: 'fast', phaseLeft: run.cfg.fast, round: 1, lapStart: 0, lapDist: 0, kmSpoken: 0 });
  gpsStop(); keepAwake(false);
  $('#lapList').innerHTML = ''; paintRun(); renderRunHistory();
}
$('#runStart').onclick = toggleRun;
$('#runReset').onclick = resetRun;
$('#runLap').onclick = () => {
  if (!run.on) return;
  if (run.mode === 'int') { run.phaseLeft = 0; nextPhase(); paintRun(); return; }
  run.laps.push({ t: run.elapsed - run.lapStart, d: run.dist - run.lapDist }); run.lapStart = run.elapsed; run.lapDist = run.dist;
  $('#lapList').innerHTML = '<h2>Vueltas</h2>' + run.laps.map((l, i) => `<div class="row"><span>Vuelta ${i + 1}</span><span style="font-variant-numeric:tabular-nums">${mmss(l.t)} · ${Math.round(l.d)} m</span></div>`).reverse().join('');
  paintRun();
};
function renderRunHistory() {
  const rs = S().runs.slice(-5).reverse();
  $('#runHistory').innerHTML = rs.length ? rs.map((r) => {
    const pace = r.dist > 50 ? r.dur / (r.dist / 1000) : 0;
    return `<div class="row"><span>${shortDate(r.date)} · ${r.mode === 'int' ? 'intervalos' : 'libre'}</span><span style="font-variant-numeric:tabular-nums">${fmt(r.dist / 1000, 2)} km · ${mmss(r.dur)}${pace ? " · " + Math.floor(pace / 60) + "'" + String(Math.round(pace % 60)).padStart(2, '0') + '"' : ''}</span></div>`;
  }).join('') : '<p class="empty">Todavía no registraste carreras.</p>';
}

/* temporizador de descanso (correr) */
const tm = { total: 60, end: 0, left: 60, on: false, t: null };
const tmPresets = [30, 60, 90, 120, 180];
function paintTimer() {
  $('#tmClock').textContent = mss(Math.ceil(tm.left));
  $('#tmBar').style.width = (tm.left / tm.total * 100) + '%';
  $('#tmStart').textContent = tm.on ? 'Pausa' : tm.left < tm.total && tm.left > 0 ? 'Seguir' : 'Empezar';
  $('#tmState').textContent = tm.on ? 'Descansando' : tm.left <= 0 ? 'Listo' : tm.left < tm.total ? 'En pausa' : 'Elegí un tiempo';
  $('#timerBox').classList.toggle('on', tm.on);
  $('#tmPresets').innerHTML = tmPresets.map((s) => `<button class="chip" aria-pressed="${s === tm.total}" data-tm="${s}">${mss(s)}</button>`).join('');
  $$('[data-tm]').forEach((b) => (b.onclick = () => { clearInterval(tm.t); Object.assign(tm, { total: +b.dataset.tm, left: +b.dataset.tm, on: false }); bgHold('tm', false); paintTimer(); }));
}
function tmTick() {
  const prev = Math.ceil(tm.left);
  tm.left = (tm.end - Date.now()) / 1000;
  const cur = Math.ceil(tm.left);
  if (cur !== prev && cur <= 3 && cur > 0) beep(660, 0.1);
  if (tm.left <= 0) { tm.left = 0; tm.on = false; clearInterval(tm.t); beep(988, 0.25, 3); buzz([200, 100, 200]); toast('Descanso terminado. A seguir'); notify('Descanso terminado', 'A seguir'); bgHold('tm', false); }
  paintTimer();
}
$('#tmStart').onclick = () => {
  if (tm.left <= 0) tm.left = tm.total;
  tm.on = !tm.on;
  if (tm.on) { tm.end = Date.now() + tm.left * 1000; tm.t = setInterval(tmTick, 200); } else clearInterval(tm.t);
  bgHold('tm', tm.on);
  paintTimer();
};
$('#tmPlus').onclick = () => { tm.left += 15; if (tm.on) tm.end += 15e3; tm.total = Math.max(tm.total, tm.left); paintTimer(); };
$('#tmReset').onclick = () => { clearInterval(tm.t); tm.on = false; tm.left = tm.total; bgHold('tm', false); paintTimer(); };
function renderCorrer() { paintRun(); paintTimer(); renderRunHistory(); }

/* ---------- PROGRESO ---------- */
function niceTicks(min, max, n = 3) {
  if (max - min < 1) { min -= 1; max += 1; }
  const step = Math.pow(10, Math.floor(Math.log10((max - min) / n)));
  const s = [1, 2, 2.5, 5, 10].map((m) => m * step).find((x) => (max - min) / x <= n + 1);
  const lo = Math.floor(min / s) * s, out = [];
  for (let v = lo; v <= max + s * 0.01; v += s) out.push(Math.round(v * 10) / 10);
  if (out[out.length - 1] < max) out.push(Math.round((out[out.length - 1] + s) * 10) / 10);
  return out;
}
function barChart(vals, labels) {
  const W = 320, Hh = 150, L = 30, B = 18, T = 8;
  const ticks = niceTicks(Math.min(...vals) * 0.97, Math.max(...vals));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = (v) => T + (Hh - B - T) * (1 - (v - lo) / (hi - lo));
  const bw = (W - L) / Math.max(vals.length, 6);
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="1RM estimado por semana">`;
  ticks.forEach((t) => (s += `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(246,237,241,.08)"/><text x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${fmt(t)}</text>`));
  vals.forEach((v, i) => {
    const x = L + i * bw + 3, last = i === vals.length - 1;
    s += `<rect x="${x}" y="${y(v)}" width="${bw - 6}" height="${Hh - B - y(v)}" rx="2" fill="${last ? '#469110' : 'rgba(246,237,241,.16)'}"/>`;
    if (i === 0 || last || i % 3 === 0) s += `<text x="${x + (bw - 6) / 2}" y="${Hh - 5}" text-anchor="middle">${labels[i]}</text>`;
  });
  return s + '</svg>';
}
function lineChart(vals, trend, firstLbl, lastLbl) {
  const W = 320, Hh = 130, L = 30, B = 18, T = 8;
  const all = vals.concat(trend);
  const ticks = niceTicks(Math.min(...all) - 0.2, Math.max(...all) + 0.1);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (i) => L + 4 + (W - L - 12) * (vals.length === 1 ? 0.5 : i / (vals.length - 1));
  const y = (v) => T + (Hh - B - T) * (1 - (v - lo) / (hi - lo));
  let s = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Peso corporal">`;
  ticks.forEach((t) => (s += `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(246,237,241,.08)"/><text x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${fmt(t)}</text>`));
  vals.forEach((v, i) => (s += `<circle cx="${x(i)}" cy="${y(v)}" r="2" fill="rgba(246,237,241,.35)"/>`));
  s += `<polyline points="${trend.map((v, i) => x(i) + ',' + y(v)).join(' ')}" fill="none" stroke="#E673AC" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<circle cx="${x(trend.length - 1)}" cy="${y(trend[trend.length - 1])}" r="4" fill="#E673AC"/>`;
  s += `<text x="${x(0)}" y="${Hh - 5}">${firstLbl}</text><text x="${x(vals.length - 1)}" y="${Hh - 5}" text-anchor="end">${lastLbl}</text>`;
  return s + '</svg>';
}
let liftSel = 'sentadilla';
const lvlColors = ['rgba(246,237,241,.14)', '#660033', '#E673AC', '#469110', '#00520A'];
function lvlPos(ratio, th) {
  if (ratio < th[0]) return ratio / th[0];
  for (let i = 0; i < 4; i++) if (ratio < th[i + 1]) return 1 + i + (ratio - th[i]) / (th[i + 1] - th[i]);
  return 5;
}
/* 1RM actual: mejor estimación de las últimas 12 semanas; si no hay, el de referencia */
function currentORM(id) {
  const b = bestE1RM(id, Date.now() - 84 * DAY).best;
  return b || S().profile.orm[id] || 0;
}
function renderLevels() {
  const bw = currentBW(), std = STANDARDS[S().profile.sex];
  $('#stdM').setAttribute('aria-pressed', S().profile.sex === 'M'); $('#stdF').setAttribute('aria-pressed', S().profile.sex === 'F');
  const rows = MAIN_LIFTS.map(({ id, n }) => {
    const orm = currentORM(id);
    if (!orm || !bw) return { n, none: true };
    const ratio = orm / bw, th = std[id], pos = lvlPos(ratio, th), idx = Math.max(0, Math.min(4, Math.floor(pos) - 1));
    const next = th.find((t) => t > ratio);
    return { n, orm, ratio, pos, lvl: ratio < th[0] ? 'Principiante' : LEVELS[idx], lvlI: ratio < th[0] ? 0 : idx, next: next ? { name: LEVELS[th.indexOf(next)], kg: Math.ceil(next * bw / 2.5) * 2.5 } : null };
  });
  const have = rows.filter((r) => !r.none);
  if (have.length) {
    const avg = have.reduce((a, r) => a + r.pos, 0) / have.length;
    $('#lvlBig').textContent = avg < 1 ? 'Principiante' : LEVELS[Math.max(0, Math.min(4, Math.floor(avg) - 1))];
    $('#lvlSub').textContent = 'Promedio de ' + have.length + (have.length === 1 ? ' levantamiento' : ' levantamientos') + ' · peso ' + fmt(bw) + ' kg';
  } else { $('#lvlBig').textContent = '–'; $('#lvlSub').textContent = 'Registrá sentadilla, banca, peso muerto o press militar para ver tu nivel.'; }
  $('#lvlList').innerHTML = rows.map((r) => r.none ? `<div class="lvl"><div class="lvl-top"><span>${r.n}</span><span class="pill p-line">Sin datos</span></div></div>` : `
    <div class="lvl">
      <div class="lvl-top"><span>${r.n}</span><span class="pill" style="background:${lvlColors[r.lvlI]};color:${r.lvlI === 2 ? 'var(--pink-ink)' : r.lvlI === 0 ? 'var(--muted)' : '#fff'}">${r.lvl}</span></div>
      <div class="lvl-num"><b>${fmt(r.ratio, 2)}×</b> tu peso · ${fmt(r.orm)} kg</div>
      <div class="lvl-scale" role="img" aria-label="${r.n}: ${r.lvl}, ${fmt(r.ratio, 2)} veces tu peso">${LEVELS.map((_, i) => `<i style="background:${lvlColors[i]}"></i>`).join('')}<span class="lvl-mark" style="left:${r.pos >= 5 ? 96 : Math.max(1, (r.pos - 1) / 5 * 100)}%"></span></div>
      <div class="lvl-next">${r.next ? `${r.next.name} a <b>${fmt(r.next.kg)} kg</b> · te faltan ${fmt(Math.max(0, r.next.kg - r.orm))} kg` : 'Llegaste al nivel más alto'}</div>
    </div>`).join('');
}
$('#stdM').onclick = () => { update((st) => { st.profile.sex = 'M'; }); renderLevels(); };
$('#stdF').onclick = () => { update((st) => { st.profile.sex = 'F'; }); renderLevels(); };
/* ---------- historial por mes y año ---------- */
let histView = 'mes', histY = new Date().getFullYear(), histM = new Date().getMonth();
const monthName = (m) => cap(MONTHS[m]);
const inMonth = (d, y, m) => { d = new Date(d); return d.getFullYear() === y && d.getMonth() === m; };
const inYear = (d, y) => new Date(d).getFullYear() === y;
const exName = (id) => (EXERCISES[id] ? EXERCISES[id].n : id);
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
/* Kilos movidos en una serie (peso × repeticiones); no cuenta lastre ni bandas */
const setTon = (x) => { const e = EXERCISES[x.ex]; return !e || e.added || e.band ? 0 : (x.kg || 0) * (x.reps || 0) * (e.perHand ? 2 : 1); };
const fmtTon = (kg) => (kg >= 1000 ? fmt(kg / 1000, 1) + ' t' : fmt(kg, 0) + ' kg');
/* Primer registro (fuerza o carrera): hasta ahí se puede ir hacia atrás */
function firstDate() {
  const t = sessions().map((s) => new Date(s.date).getTime()).concat(S().runs.map((r) => new Date(r.date).getTime()));
  return t.length ? new Date(Math.min(...t)) : new Date();
}
const firstIdx = () => { const f = firstDate(); return f.getFullYear() * 12 + f.getMonth(); };
/* Resumen de los entrenamientos cuya fecha cumple `keep` */
function periodStats(keep) {
  const r = { ss: [], days: new Set(), sets: 0, ton: 0, mus: {}, best: {}, nsets: {}, runs: 0 };
  sessions().forEach((s) => {
    if (!keep(s.date)) return;
    r.ss.push(s); r.days.add(dateKey(s.date));
    s.sets.forEach((x) => {
      const e = EXERCISES[x.ex];
      r.sets++; r.ton += setTon(x);
      (e ? e.m : []).forEach((m) => (r.mus[m] = (r.mus[m] || 0) + 1));
      r.nsets[x.ex] = (r.nsets[x.ex] || 0) + 1;
      if (x.kg > 0 && e && !e.added && !e.band) r.best[x.ex] = Math.max(r.best[x.ex] || 0, e1rm(x.kg, x.reps, x.rir));
    });
  });
  r.runs = S().runs.filter((x) => keep(x.date)).length;
  return r;
}
/* Cambio respecto del período anterior: ↑ mejoró, ↓ bajó, = igual */
function delta(cur, prev, f = (v) => fmt(v, 0)) {
  if (prev == null) return '';
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return '<span class="dl eq">= igual</span>';
  return `<span class="dl ${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑ +' : '↓ −'}${f(Math.abs(d))}</span>`;
}
/* Ejercicios ordenados: los 4 básicos primero, después los que tienen más series */
const exOrder = (ids, nsets) => ids.sort((a, b) => {
  const ia = MAIN_LIFTS.findIndex((l) => l.id === a), ib = MAIN_LIFTS.findIndex((l) => l.id === b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (nsets[b] || 0) - (nsets[a] || 0);
});
/* Semanas del mes (las que tienen su jueves en el mes) en las que se llegó a la meta de días del plan.
   La semana en curso cuenta solo si ya se cumplió. */
function weeksMet(y, m) {
  const goal = planDays(), now = new Date();
  let met = 0, tot = 0;
  for (let w = weekStart(new Date(y, m, 1)); w <= new Date(y, m + 1, 0); w.setDate(w.getDate() + 7)) {
    const thu = new Date(w); thu.setDate(thu.getDate() + 3);
    if (thu.getMonth() !== m || w > now) continue;
    const end = new Date(w); end.setDate(end.getDate() + 7);
    const days = new Set(sessions().filter((s) => { const d = new Date(s.date); return d >= w && d < end; }).map((s) => dateKey(s.date))).size;
    if (days >= goal) met++;
    if (days >= goal || end <= now) tot++;
  }
  return { met, tot };
}
function renderHist() {
  const now = new Date(), maxI = now.getFullYear() * 12 + now.getMonth(), minI = firstIdx();
  $('#hMes').setAttribute('aria-pressed', histView === 'mes'); $('#hAnio').setAttribute('aria-pressed', histView === 'anio');
  if (histView === 'mes') {
    const i = histY * 12 + histM;
    $('#hLbl').textContent = monthName(histM) + ' ' + histY;
    $('#hPrev').disabled = i <= minI; $('#hNext').disabled = i >= maxI;
    $('#hPrev').setAttribute('aria-label', 'Mes anterior'); $('#hNext').setAttribute('aria-label', 'Mes siguiente');
    renderMonth();
  } else {
    $('#hLbl').textContent = histY;
    $('#hPrev').disabled = histY <= Math.floor(minI / 12); $('#hNext').disabled = histY >= now.getFullYear();
    $('#hPrev').setAttribute('aria-label', 'Año anterior'); $('#hNext').setAttribute('aria-label', 'Año siguiente');
    renderYear();
  }
}
function histStep(dir) {
  if (histView === 'mes') { const i = histY * 12 + histM + dir; histY = Math.floor(i / 12); histM = i % 12; } else histY += dir;
  renderHist();
}
$('#hPrev').onclick = () => histStep(-1);
$('#hNext').onclick = () => histStep(1);
$('#hMes').onclick = () => { histView = 'mes'; renderHist(); };
$('#hAnio').onclick = () => { histView = 'anio'; renderHist(); };
function renderMonth() {
  const y = histY, m = histM, now = new Date(), tk = dateKey();
  const cur = periodStats((d) => inMonth(d, y, m));
  const pm = (m + 11) % 12, py = m ? y : y - 1;
  const isNow = y === now.getFullYear() && m === now.getMonth();
  // el mejor 1RM se compara con todo el mes anterior; las cantidades del mes en curso, con el anterior hasta el mismo día
  const prev = py * 12 + pm >= firstIdx() ? periodStats((d) => inMonth(d, py, pm)) : null;
  const prevQ = prev && isNow ? periodStats((d) => inMonth(d, py, pm) && new Date(d).getDate() <= now.getDate()) : prev;
  // calendario: los días con fuerza se tocan para ver el entrenamiento
  const rDays = new Set(S().runs.map((r) => dateKey(r.date)));
  const offset = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  let cal = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="wd">${d}</span>`).join('');
  for (let i = 0; i < offset; i++) cal += '<span></span>';
  for (let d = 1; d <= dim; d++) {
    const k = dateKey(new Date(y, m, d));
    if (cur.days.has(k)) cal += `<button class="d s" data-day="${k}" aria-label="Ver entrenamiento del ${d} de ${MONTHS[m]}">${d}</button>`;
    else cal += `<span class="d ${rDays.has(k) ? 'r' : k === tk ? 't' : k > tk ? 'f' : ''}">${d}</span>`;
  }
  const wm = weeksMet(y, m);
  let h = `<div>
    <div class="big" style="font-size:64px">${plural(cur.days.size, 'día', 'días')}</div>
    <p class="sub" style="margin:8px 0 14px">con fuerza · ${plural(cur.runs, 'carrera', 'carreras')}${wm.tot ? ` · meta de ${planDays()} por semana cumplida en ${wm.met} de ${plural(wm.tot, 'semana', 'semanas')}` : ''}</p>
    <div class="cal">${cal}</div>
    <div class="legend" style="margin-top:12px"><span><i style="background:var(--pink)"></i>Fuerza (tocá para ver)</span><span><i style="background:var(--green)"></i>Correr</span><span><i style="background:rgba(246,237,241,.18)"></i>Descanso</span></div>
  </div>`;
  if (!cur.ss.length) {
    $('#histBox').innerHTML = h + `<p class="empty">No hay entrenamientos de fuerza en ${MONTHS[m]} ${y}.</p>`;
    bindHist(cur); return;
  }
  h += `<div>
    <div class="stats">
      <div><b>${cur.ss.length}</b><span>entrenamientos</span>${delta(cur.ss.length, prevQ && prevQ.ss.length)}</div>
      <div><b>${cur.sets}</b><span>series</span>${delta(cur.sets, prevQ && prevQ.sets)}</div>
      <div><b>${fmtTon(cur.ton)}</b><span>movidos</span>${delta(cur.ton, prevQ && prevQ.ton, fmtTon)}</div>
    </div>
    <p class="sub note">${prev ? `Comparado con ${MONTHS[pm]}${isNow ? ' hasta el día ' + now.getDate() : ''}.` : 'Es tu primer mes registrado: desde el próximo ves la comparación.'}</p>
  </div>`;
  // series por músculo en el mes; la barra llena es la meta semanal de cada músculo por las semanas del mes
  h += `<div><h2>Series por músculo</h2><div style="margin-top:6px">` + MUSCLES.map((mu) => {
    const a = cur.mus[mu.id] || 0, goal = Math.round(mu.target * dim / 7);
    return `<div class="vol volm"><span>${mu.n}</span><div class="bar" style="height:8px"><i style="width:${Math.min(100, a / goal * 100)}%;background:${a >= goal ? 'var(--green)' : 'var(--pink)'}"></i></div><span>${a}${delta(a, prevQ && (prevQ.mus[mu.id] || 0))}</span></div>`;
  }).join('') + `</div><p class="sub note">La barra llena es tu meta semanal por las semanas del mes.</p></div>`;
  // mejor 1RM estimado de cada ejercicio contra el mes anterior
  const ids = exOrder(Object.keys(cur.best), cur.nsets);
  if (ids.length) h += `<div><h2>1RM estimado por ejercicio</h2>` + ids.map((id) => {
    const p = prev && prev.best[id];
    return `<div class="row"><span>${esc(exName(id))}<span class="xs sub">${plural(cur.nsets[id], 'serie', 'series')}</span></span><span class="num">${fmt(cur.best[id])} kg${prev ? (p ? delta(cur.best[id], p, (v) => fmt(v) + ' kg') : '<span class="dl new">nuevo</span>') : ''}</span></div>`;
  }).join('') + `<p class="sub note">El mejor del mes en cada ejercicio, contra el mejor del mes anterior. Si una flecha no sube durante varios meses, ahí te estancaste.</p></div>`;
  h += `<div><h2>Entrenamientos</h2>` + cur.ss.slice().reverse().map((s) => `
    <button class="row srow" data-sess="${s.id}">
      <span><b>${shortDate(s.date)}</b> · ${esc(s.dayName || 'Entrenamiento')}<span class="xs sub">${esc(s.planName || '')}</span></span>
      <span class="sub num">${plural(s.sets.length, 'serie', 'series')}${s.dur ? ' · ' + Math.round(s.dur / 60) + ' min' : ''}<span class="ms" aria-hidden="true">chevron_right</span></span>
    </button>`).join('') + '</div>';
  $('#histBox').innerHTML = h;
  bindHist(cur);
}
function bindHist(cur) {
  $$('#histBox [data-day]').forEach((b) => (b.onclick = () => openSess(cur.ss.filter((s) => dateKey(s.date) === b.dataset.day))));
  $$('#histBox [data-sess]').forEach((b) => (b.onclick = () => openSess(cur.ss.filter((s) => s.id === b.dataset.sess))));
}
function renderYear() {
  const y = histY, now = new Date(), minI = firstIdx();
  const cur = periodStats((d) => inYear(d, y));
  // el año en curso se compara con el anterior hasta la misma fecha
  const isNow = y === now.getFullYear(), cut = new Date(now); cut.setFullYear(y - 1);
  const prev = y - 1 >= Math.floor(minI / 12) ? periodStats((d) => inYear(d, y - 1) && (!isNow || new Date(d) <= cut)) : null;
  let h = `<div>
    <div class="big" style="font-size:64px">${plural(cur.days.size, 'día', 'días')}</div>
    <p class="sub" style="margin:8px 0 14px">con fuerza en ${y} · ${plural(cur.runs, 'carrera', 'carreras')}</p>
    <div class="stats">
      <div><b>${cur.ss.length}</b><span>entrenamientos</span>${delta(cur.ss.length, prev && prev.ss.length)}</div>
      <div><b>${cur.sets}</b><span>series</span>${delta(cur.sets, prev && prev.sets)}</div>
      <div><b>${fmtTon(cur.ton)}</b><span>movidos</span>${delta(cur.ton, prev && prev.ton, fmtTon)}</div>
    </div>
    ${prev ? `<p class="sub note">Comparado con ${y - 1}${isNow ? ' hasta el ' + now.getDate() + ' de ' + MONTHS[now.getMonth()] : ''}.</p>` : ''}
  </div>`;
  // mes a mes, desde el primer mes con datos hasta hoy; un toque abre el mes
  const from = Math.max(0, minI - y * 12), to = y === now.getFullYear() ? now.getMonth() : 11;
  const months = [];
  for (let m = from; m <= to; m++) months.push({ m, st: periodStats((d) => inMonth(d, y, m)) });
  const maxD = Math.max(1, ...months.map((x) => x.st.days.size));
  h += `<div><h2>Mes a mes</h2>` + months.map(({ m, st }, i) => {
    const pv = i ? months[i - 1].st : null;
    return `<button class="row srow mrow" data-month="${m}">
      <span>${monthName(m)}</span>
      <div class="bar" style="height:8px"><i style="width:${st.days.size / maxD * 100}%;background:var(--pink)"></i></div>
      <span class="sub num">${st.days.size ? plural(st.days.size, 'día', 'días') + ' · ' + fmtTon(st.ton) : '—'}${pv && (st.ton || pv.ton) ? delta(st.ton, pv.ton, fmtTon) : ''}</span>
    </button>`;
  }).join('') + `<p class="sub note">Días con fuerza y kilos movidos; la flecha compara con el mes anterior. Tocá un mes para verlo.</p></div>`;
  // cada ejercicio: mejor 1RM del primer mes del año en que lo hiciste contra el del último
  const rows = [];
  exOrder(Object.keys(cur.best), cur.nsets).forEach((id) => {
    const ms = months.filter((x) => x.st.best[id]);
    if (ms.length < 2) return;
    const a = ms[0], b = ms[ms.length - 1];
    rows.push(`<div class="row"><span>${esc(exName(id))}<span class="xs sub">${monthName(a.m)} → ${monthName(b.m)} · mejor ${fmt(cur.best[id])} kg</span></span><span class="num">${fmt(a.st.best[id])} → ${fmt(b.st.best[id])} kg${delta(b.st.best[id], a.st.best[id], (v) => fmt(v) + ' kg')}</span></div>`);
  });
  if (rows.length) h += `<div><h2>Avance del año · 1RM estimado</h2>${rows.join('')}<p class="sub note">Primer mes contra último mes en que hiciste cada ejercicio.</p></div>`;
  else if (!cur.ss.length) h += `<p class="empty">No hay entrenamientos de fuerza en ${y}.</p>`;
  $('#histBox').innerHTML = h;
  $$('#histBox [data-month]').forEach((b) => (b.onclick = () => { histView = 'mes'; histM = +b.dataset.month; renderHist(); $('#main').scrollTop = 0; }));
}
/* Detalle de uno o más entrenamientos (los de un día del calendario) */
function openSess(list) {
  if (!list.length) return;
  $('#sessT').textContent = list.length === 1 ? shortDate(list[0].date) : shortDate(list[0].date) + ' · ' + list.length + ' entrenamientos';
  $('#sessBody').innerHTML = list.map((s) => {
    const d = new Date(s.date), groups = [];
    s.sets.forEach((x) => { const g = groups[groups.length - 1]; if (g && g.ex === x.ex && g.slot === x.slot) g.sets.push(x); else groups.push({ ex: x.ex, slot: x.slot, sets: [x] }); });
    const ton = s.sets.reduce((a, x) => a + setTon(x), 0), sv = s.survey, at = d.getTime();
    const ras = [...new Set(s.sets.map((x) => EXERCISES[x.ex]?.m[0]).filter(Boolean))].map((m) => ({ mu: MUSCLES.find((y) => y.id === m), ra: readaptOf(m, at) })).filter((x) => x.ra);
    return `<div class="sd">
      <div><div class="sd-n">${esc(s.dayName || 'Entrenamiento')}</div>
        <div class="sub">${WD_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}${s.planName ? ' · ' + esc(s.planName) : ''}</div>
        <div class="sub">${plural(s.sets.length, 'serie', 'series')} · ${fmtTon(ton)} movidos${s.dur ? ' · ' + Math.round(s.dur / 60) + ' min' : ''}</div></div>
      ${groups.map((g) => { const e = EXERCISES[g.ex] || {}; return `<div class="sd-ex"><div class="sd-exn">${esc(exName(g.ex))}</div>${g.sets.map((x, i) => `<div class="sd-set"><span>${i + 1}</span><span>${kgLabel(e, x.kg)} × ${x.reps}</span><span>RIR ${x.rir}</span></div>`).join('')}</div>`; }).join('')}
      ${ras.length ? `<p class="recnote">Readaptación: ${ras.map(({ mu, ra }) => `${mu.n.toLowerCase()} sesión ${ra.step + 1} de ${ra.steps.length} (${pctTxt(ra.pct)}) después de ${ra.days} días sin entrenar`).join('; ')}.</p>` : ''}
      ${(s.swaps || []).length ? `<p class="sub note">${s.swaps.map((w) => `Cambiaste ${esc(exName(w.from))} por ${esc(exName(w.to))}${w.reason === 'recuperacion' ? ' por recuperación' : ''}.`).join(' ')}</p>` : ''}
      ${sv ? `<p class="sub note">Encuesta: fatiga ${sv.fat.toLowerCase()} · ${({ No: 'sin molestia articular', Leve: 'molestia articular leve', 'Sí': 'con dolor articular' })[sv.joint] || ''} · rendimiento ${sv.perf.toLowerCase()}.</p>` : ''}
    </div>`;
  }).join('');
  $('#sess').hidden = false; $('#sheetBg').hidden = false; $('#sessBody').scrollTop = 0;
}
function closeSess() { if ($('#sess').hidden) return; $('#sess').hidden = true; $('#sheetBg').hidden = true; }
$('#sessX').onclick = closeSess;

function renderProgreso() {
  renderHist();
  renderLevels();

  // 1RM por semana (últimas 12)
  $('#liftChips').innerHTML = MAIN_LIFTS.map((l) => `<button class="chip" aria-pressed="${l.id === liftSel}" data-lift="${l.id}">${l.n}</button>`).join('');
  $$('[data-lift]').forEach((b) => (b.onclick = () => { liftSel = b.dataset.lift; renderProgreso(); }));
  const ws = weekStart(), vals = [], labels = [];
  for (let w = 11; w >= 0; w--) {
    const a = new Date(ws); a.setDate(a.getDate() - 7 * w); const b = new Date(a); b.setDate(b.getDate() + 7);
    let best = 0;
    sessions().forEach((s) => { const d = new Date(s.date); if (d >= a && d < b) s.sets.forEach((x) => { if (x.ex === liftSel && x.kg > 0) best = Math.max(best, e1rm(x.kg, x.reps, x.rir)); }); });
    if (best) { vals.push(best); labels.push(w === 0 ? 'esta' : a.getDate() + '/' + (a.getMonth() + 1)); }
  }
  if (vals.length) {
    const d = vals.length > 1 ? vals[vals.length - 1] - vals[0] : 0;
    $('#liftBox').innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="big" style="font-size:56px">${fmt(vals[vals.length - 1])}</span><span style="font-size:18px">kg</span>${vals.length > 1 ? `<span class="pill ${d >= 0 ? 'p-ready' : 'p-rest'}">${d >= 0 ? '+' : ''}${fmt(d)} kg en ${vals.length} sem.</span>` : ''}</div><div class="chart" style="margin-top:14px">${barChart(vals, labels)}</div>`;
  } else {
    const ref = S().profile.orm[liftSel];
    $('#liftBox').innerHTML = `<p class="empty">Todavía no registraste ${MAIN_LIFTS.find((l) => l.id === liftSel).n.toLowerCase()}.${ref ? ' Tu 1RM de referencia es ' + fmt(ref) + ' kg.' : ''} El gráfico aparece después de tu primer entrenamiento.</p>`;
  }

  // peso corporal (últimos 60 días) con tendencia suavizada
  const bws = S().bodyweight.filter((b) => new Date(b.d + 'T12:00') >= new Date(Date.now() - 60 * DAY));
  if (bws.length >= 2) {
    const v = bws.map((b) => b.kg), trend = [];
    v.forEach((x, i) => trend.push(i === 0 ? x : trend[i - 1] + 0.25 * (x - trend[i - 1])));
    const d = Math.round((trend[trend.length - 1] - trend[0]) * 10) / 10;
    $('#bwBox').innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="big" style="font-size:44px">${fmt(trend[trend.length - 1])}</span><span>kg de tendencia</span><span class="sub">${d >= 0 ? '+' : ''}${fmt(d)} kg desde ${shortDate(bws[0].d + 'T12:00')}</span></div><div class="chart" style="margin-top:12px">${lineChart(v, trend, shortDate(bws[0].d + 'T12:00'), 'hoy')}</div><p class="sub" style="font-size:12px;margin:6px 0 0">Los puntos son cada registro; la línea rosa suaviza las variaciones de agua de un día a otro.</p>`;
  } else $('#bwBox').innerHTML = '<p class="empty">Registrá tu peso en la pantalla Hoy. Con dos registros aparece el gráfico.</p>';

  // series por músculo esta semana
  const count = weekSetsDone();
  $('#volList').innerHTML = MUSCLES.map((m) => { const a = count[m.id] || 0; return `<div class="vol"><span>${m.n}</span><div class="bar" style="height:8px"><i style="width:${Math.min(100, a / m.target * 100)}%;background:${a >= m.target ? 'var(--green)' : 'var(--pink)'}"></i></div><span>${a}/${m.target}</span></div>`; }).join('');

  // récords
  const recs = [];
  Object.keys(EXERCISES).forEach((id) => { const e = EXERCISES[id]; if (e.added || e.band) return; const b = bestE1RM(id); if (b.best) recs.push({ n: e.n, b }); });
  recs.sort((a, b) => b.b.best - a.b.best);
  const runs = S().runs.filter((r) => r.dist >= 1000);
  const longest = runs.reduce((a, r) => (!a || r.dist > a.dist ? r : a), null);
  const fastest = runs.reduce((a, r) => (!a || r.dur / r.dist < a.dur / a.dist ? r : a), null);
  let html = recs.slice(0, 8).map((r) => `<div class="row"><span>${r.n}</span><span style="font-variant-numeric:tabular-nums">${fmt(r.b.at.kg)} kg × ${r.b.at.reps} <span class="sub" style="font-size:12px">· 1RM ${fmt(r.b.best)} · ${shortDate(r.b.at.date)}</span></span></div>`).join('');
  if (longest) html += `<div class="row"><span>Carrera más larga</span><span>${fmt(longest.dist / 1000, 2)} km <span class="sub" style="font-size:12px">· ${shortDate(longest.date)}</span></span></div>`;
  if (fastest) { const p = fastest.dur / (fastest.dist / 1000); html += `<div class="row"><span>Mejor ritmo</span><span>${Math.floor(p / 60)}'${String(Math.round(p % 60)).padStart(2, '0')}"/km <span class="sub" style="font-size:12px">· ${shortDate(fastest.date)}</span></span></div>`; }
  $('#prList').innerHTML = html || '<p class="empty">Tus récords aparecen acá a medida que entrenás.</p>';
}

/* ---------- NUTRICIÓN ---------- */
const words = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, media: 0.5, medio: 0.5 };
function analyzeLocal(text) {
  const parts = text.toLowerCase().split(/,|\sy\s|\scon\s|\+|\n/);
  const tot = { kcal: 0, p: 0, c: 0, g: 0 }; let found = 0;
  parts.forEach((pt) => {
    const f = FOODS.find((f) => f.k.some((k) => pt.includes(k))); if (!f) return;
    found++;
    let qty = null, grams = null;
    const gm = pt.match(/(\d+[.,]?\d*)\s*(g|gr|gramos)\b/); if (gm) grams = parseFloat(gm[1].replace(',', '.'));
    const nm = pt.match(/(\d+[.,]?\d*)/), wm = pt.match(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|media|medio)\b/);
    if (!grams) qty = nm ? parseFloat(nm[1].replace(',', '.')) : wm ? words[wm[1]] : 1;
    const mult = f.unit === 'g' ? (grams || (qty || 1) * f.u) / 100 : grams ? grams / 100 : qty || 1;
    tot.kcal += f.kcal * mult; tot.p += f.p * mult; tot.c += f.c * mult; tot.g += f.g * mult;
  });
  return found ? tot : null;
}
const mealsToday = () => S().meals.filter((m) => m.d === todayK());
function mealTotals() { return mealsToday().reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, g: a.g + m.g }), { kcal: 0, p: 0, c: 0, g: 0 }); }
function mealLabel() { const h = new Date(); return (h.getHours() < 11 ? 'Desayuno' : h.getHours() < 16 ? 'Almuerzo' : h.getHours() < 20 ? 'Merienda' : 'Cena') + ' · ' + h.getHours() + ':' + String(h.getMinutes()).padStart(2, '0'); }
function addMeal(label, text, t, src, note) {
  update((st) => { st.meals.push({ id: uid(), d: todayK(), label, text, kcal: t.kcal, p: t.p, c: t.c, g: t.g, src, note: note || '' }); });
  renderNutricion();
}
const hasKey = () => !!S().settings.apiKey;
function renderNutricion() {
  const g = S().profile.goals, t = mealTotals(), d = new Date();
  $('#nutDate').textContent = 'Nutrición · ' + WD[d.getDay()].toLowerCase() + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
  const pc = (v, goal) => Math.min(100, v / goal * 100) + '%';
  $('#kcalBig').textContent = fmt(t.kcal, 0); $('#mP').textContent = fmt(t.p, 0); $('#mC').textContent = fmt(t.c, 0); $('#mG').textContent = fmt(t.g, 0);
  $('#gK').textContent = '/ ' + fmt(g.kcal, 0); $('#gP').textContent = '/ ' + g.p; $('#gC').textContent = '/ ' + g.c; $('#gG').textContent = '/ ' + g.g;
  $('#kcalBar').style.width = pc(t.kcal, g.kcal); $('#pBar').style.width = pc(t.p, g.p); $('#cBar').style.width = pc(t.c, g.c); $('#gBar').style.width = pc(t.g, g.g);
  $('#mMeals').textContent = mealsToday().length;
  const left = g.p - t.p;
  $('#protLeft').innerHTML = left > 0 ? `<span class="ms" style="font-size:18px">info</span>Te faltan <b>${fmt(left, 0)} g de proteína</b> para llegar a tu meta de hoy.` : '<span class="ms" style="font-size:18px">check_circle</span>Llegaste a tu meta de proteína de hoy.';
  $('#foodBtnTxt').textContent = hasKey() ? 'Calcular con IA' : 'Calcular';
  $('#foodMode').textContent = hasKey() ? 'Lo calcula ' + AI.MODELS[S().settings.model].label + '. Sin conexión se usa la tabla de alimentos.' : 'Sin clave de API se usa una tabla de alimentos básica. Cargá tu clave en Ajustes para que lo calcule la IA.';
  const ms = mealsToday();
  $('#meals').innerHTML = ms.length ? '<h2>Hoy</h2>' + ms.slice().reverse().map((m) => `<div class="meal"><div class="t"><span>${esc(m.label)}</span><span style="font-variant-numeric:tabular-nums">${fmt(m.kcal, 0)} kcal</span></div><div class="sub" style="font-size:13px">${esc(m.text)}</div><div class="m">P ${fmt(m.p, 0)} g · C ${fmt(m.c, 0)} g · G ${fmt(m.g, 0)} g · ${m.src === 'ai' ? 'IA' : 'tabla'}</div>${m.note ? `<div class="sub" style="font-size:12.5px">${esc(m.note)}</div>` : ''}<button class="del" data-del="${m.id}">Borrar</button></div>`).join('') : '';
  $$('[data-del]').forEach((b) => (b.onclick = () => { update((st) => { st.meals = st.meals.filter((m) => m.id !== b.dataset.del); }); renderNutricion(); }));
  renderRecipes();
}
$('#foodIn').oninput = () => ($('#foodErr').hidden = true);
$('#foodBtn').onclick = async () => {
  const v = $('#foodIn').value.trim(), err = $('#foodErr');
  if (!v) { err.textContent = 'Escribí qué comiste para calcularlo.'; err.hidden = false; return; }
  if (hasKey() && navigator.onLine) {
    $('#foodBtn').disabled = true; $('#foodBtnTxt').textContent = 'Calculando…';
    try {
      const r = await AI.parseMeal(S().settings, v);
      if (!r.items.length) { err.textContent = r.nota || 'No encontré comida en el texto.'; err.hidden = false; }
      else { addMeal(mealLabel(), v, r.tot, 'ai', r.nota); $('#foodIn').value = ''; toast('Comida registrada'); }
    } catch (e) {
      const t = analyzeLocal(v);
      if (t) { addMeal(mealLabel(), v, t, 'tabla'); $('#foodIn').value = ''; toast('La IA falló; lo calculé con la tabla'); }
      else { err.textContent = await AI.explainError(e); err.hidden = false; }
    } finally { $('#foodBtn').disabled = false; renderNutricion(); }
    return;
  }
  const t = analyzeLocal(v);
  if (t) { addMeal(mealLabel(), v, t, 'tabla'); $('#foodIn').value = ''; toast('Comida registrada'); }
  else { err.textContent = 'No reconocí alimentos en el texto. Probá con "2 huevos y una banana", o cargá tu clave de API para usar la IA.'; err.hidden = false; }
};
let recFilter = 'Todas';
function renderRecipes() {
  const saved = new Set(S().savedRecipes);
  $('#recFilters').innerHTML = ['Todas', 'Alta proteína', 'Pre-entreno', 'Post-entreno', 'Guardadas'].map((f) => `<button class="chip" aria-pressed="${f === recFilter}" data-rf="${f}">${f}</button>`).join('');
  $$('[data-rf]').forEach((b) => (b.onclick = () => { recFilter = b.dataset.rf; renderRecipes(); }));
  const list = RECIPES.map((r, i) => ({ ...r, i })).filter((r) => recFilter === 'Todas' || (recFilter === 'Guardadas' ? saved.has(r.i) : r.tag === recFilter));
  $('#recipes').innerHTML = list.length ? list.map((r) => {
    const m = analyzeLocal(r.foods);
    return `<article class="rec">
      <div class="rec-by"><span class="rec-av"><span class="ms" style="font-size:18px">auto_awesome</span></span><span><b>Receta para fuerza</b><br><span class="sub" style="font-size:12.5px">${r.tag} · ${r.min} min</span></span></div>
      <div class="rec-img" style="background:${r.bg};color:${r.ink}"><span class="ms rec-ic">${r.ic}</span><span class="rec-k"><b>${fmt(m.p, 0)}</b> g prot.<br>${fmt(m.kcal, 0)} kcal</span></div>
      <div class="rec-name">${r.n}</div>
      <p class="sub" style="margin:0;font-size:13.5px">${r.why}</p>
      <div style="font-family:var(--mono);font-size:11.5px;color:var(--muted)">${r.foods}</div>
      <div class="rec-act">
        <button class="btn" data-add="${r.i}" style="flex:1;display:flex;gap:6px;justify-content:center;align-items:center"><span class="ms" style="font-size:18px">add</span>Agregar a hoy</button>
        <button class="rec-save" data-save="${r.i}" aria-pressed="${saved.has(r.i)}" aria-label="Guardar receta"><span class="ms">${saved.has(r.i) ? 'bookmark_added' : 'bookmark'}</span></button>
      </div>
    </article>`;
  }).join('') : '<p class="empty">Todavía no guardaste recetas. Tocá el marcador de una receta para tenerla acá.</p>';
  $$('[data-add]').forEach((b) => (b.onclick = () => { const r = RECIPES[b.dataset.add]; addMeal(r.n, r.foods, analyzeLocal(r.foods), 'tabla'); toast('Agregado a hoy: ' + r.n); }));
  $$('[data-save]').forEach((b) => (b.onclick = () => { const i = +b.dataset.save; update((st) => { st.savedRecipes = saved.has(i) ? st.savedRecipes.filter((x) => x !== i) : [...st.savedRecipes, i]; }); renderRecipes(); }));
}

/* ---------- COACH ---------- */
const QUICK = ['¿Qué entreno hoy?', '¿Cómo vengo con la progresión?', 'Armá mi semana', '¿Cuánta proteína me falta hoy?', 'Tengo molestia en el hombro'];
function coachContext() {
  const p = S().profile, bw = currentBW(), lines = [];
  const d = new Date();
  lines.push(`Fecha: ${WD_LONG[d.getDay()]} ${d.toLocaleDateString('es-AR')}. Peso corporal: ${fmt(bw)} kg. Estándares: ${p.sex === 'M' ? 'hombres' : 'mujeres'}.`);
  const w = wellnessToday();
  lines.push(`Puntaje del día: ${readiness()} (${rdLevel().t}). Sueño ${w.s}/5, energía ${w.e}/5, molestias ${w.m}/5.`);
  lines.push('Recuperación: ' + muscleStatus().map((m) => `${m.n} ${m.st === 'ready' ? 'lista' : 'faltan ' + m.left + ' h'}`).join(', ') + '.');
  const pn = plan(), cur = S().current, day = cur ? cur.day : nextDay();
  lines.push(`Plan: ${pn.name} (${PLAN_TYPES[pn.type].n}, ${pn.days.length} días por semana, ${PL.splitLabel(pn)}). Rotación: ${pn.days.map((d, i) => (i + 1) + '. ' + d.n).join(', ')}. Días ya hechos en esta vuelta: ${pn.days.filter((d) => S().rot.done.includes(d.id)).map((d) => d.n).join(', ') || 'ninguno'}.`);
  lines.push(`Próximo entrenamiento: ${day.n}${day.t ? ' (' + day.t + ')' : ''}: ` + (day.slots.length ? day.slots.map((s, i) => { const o = cur ? curOpt(i) : s.opts[0]; const pl = planOf(o); return `${EXERCISES[o.id].n} ${o.sets}×${o.reps} a ${kgLabel(EXERCISES[o.id], pl.kg)}`; }).join('; ') : 'sin ejercicios cargados') + '.');
  const last = sessions().slice(-5);
  if (last.length) {
    lines.push('Últimos entrenamientos:');
    last.forEach((s) => {
      const by = {}; s.sets.forEach((x) => { (by[x.ex] = by[x.ex] || []).push(`${x.kg}×${x.reps}@${x.rir}`); });
      lines.push(`- ${shortDate(s.date)} ${s.dayName}${s.planName ? ' (' + s.planName + ')' : ''}: ` + Object.entries(by).map(([ex, arr]) => `${EXERCISES[ex].n} ${arr.join(' ')}`).join('; ') + ((s.swaps || []).length ? ` [cambios: ${s.swaps.map((x) => EXERCISES[x.from].n + ' → ' + EXERCISES[x.to].n + (x.reason === 'recuperacion' ? ' por recuperación' : '')).join(', ')}]` : '') + (s.survey ? ` (fatiga ${s.survey.fat}, articulaciones ${s.survey.joint}, rendimiento ${s.survey.perf})` : ''));
    });
  } else lines.push('Todavía no registró entrenamientos en la app.');
  lines.push('1RM estimados: ' + MAIN_LIFTS.map((l) => `${l.n} ${currentORM(l.id) ? fmt(currentORM(l.id)) + ' kg' : 'sin dato'}`).join(', ') + '.');
  const raC = MUSCLES.map((m) => ({ m, ra: readaptOf(m.id) })).filter((x) => x.ra);
  if (raC.length) lines.push('Readaptación por pausa de más de 14 días (la app baja los pesos sugeridos): ' + raC.map(({ m, ra }) => `${m.n} ${ra.days} días, sesión ${ra.step + 1} de ${ra.steps.length} al ${pctTxt(ra.pct)}`).join('; ') + '.');
  lines.push(`Entrenos esta semana: ${weekCount()}/${planDays()}. Semanas seguidas cumpliendo: ${streak()}.`);
  const runs = S().runs.slice(-3);
  if (runs.length) lines.push('Últimas carreras: ' + runs.map((r) => `${shortDate(r.date)} ${fmt(r.dist / 1000, 2)} km en ${mmss(r.dur)}`).join('; ') + '.');
  const t = mealTotals(), g = p.goals;
  lines.push(`Nutrición hoy: ${fmt(t.kcal, 0)}/${g.kcal} kcal, proteína ${fmt(t.p, 0)}/${g.p} g, carbos ${fmt(t.c, 0)}/${g.c} g, grasas ${fmt(t.g, 0)}/${g.g} g.`);
  return lines.join('\n');
}
function renderCoach() {
  $('#coachModel').textContent = AI.MODELS[S().settings.model].label;
  $('#coachNoKey').hidden = hasKey();
  const chat = S().chat;
  const intro = { role: 'assistant', content: 'Hola. Conozco tus entrenamientos, tu recuperación, tu peso y lo que comiste hoy. ¿En qué te ayudo?' };
  $('#chat').innerHTML = [intro, ...chat].map((m) => `<div class="msg ${m.role === 'user' ? 'me' : 'bot'}">${esc(m.content)}</div>`).join('');
  $('#quick').innerHTML = QUICK.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('');
  $$('[data-q]').forEach((b) => (b.onclick = () => ask(b.dataset.q)));
}
let asking = false;
async function ask(q) {
  if (asking) return;
  if (!hasKey()) { toast('Cargá tu clave de API en Ajustes'); $('#coachNoKey').hidden = false; return; }
  asking = true;
  update((st) => { st.chat.push({ role: 'user', content: q }); });
  renderCoach();
  const bubble = document.createElement('div'); bubble.className = 'msg bot typing'; bubble.textContent = 'Pensando…';
  $('#chat').appendChild(bubble); $('#main').scrollTop = $('#main').scrollHeight;
  let got = '';
  try {
    const history = S().chat.slice(-12);
    const full = await AI.coachStream(S().settings, history, coachContext(), (t) => {
      got += t; bubble.classList.remove('typing'); bubble.textContent = got;
      $('#main').scrollTop = $('#main').scrollHeight;
    });
    update((st) => { st.chat.push({ role: 'assistant', content: full || got }); st.chat = st.chat.slice(-30); });
    renderCoach();
  } catch (e) {
    bubble.className = 'msg err'; bubble.textContent = await AI.explainError(e);
    update((st) => { st.chat.pop(); });
  } finally { asking = false; $('#main').scrollTop = $('#main').scrollHeight; }
}
$('#chatSend').onclick = () => { const v = $('#chatIn').value.trim(); if (!v) return; $('#chatIn').value = ''; ask(v); };
$('#chatIn').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatSend').click(); } };
$('#chatClear').onclick = () => { update((st) => { st.chat = []; }); renderCoach(); };

/* ---------- MI PLAN ---------- */
const TYPE_PILL = { fuerza: 'p-almost', hipertrofia: 'p-ready', manual: 'p-line' };
function openPlan(v) { pv = v; pvKeep = true; go('plan'); }
$('#planBack').onclick = () => { if (pv.mode !== 'list') { pv = { mode: 'list' }; renderPlan(); $('#main').scrollTop = 0; } else go(planFrom); };
function renderPlan() {
  if (pv.mode === 'wizard') return renderWizard();
  if (pv.mode === 'day' && plan().days.some((d) => d.id === pv.dayId)) return renderDayEditor();
  pv = { mode: 'list' };
  renderPlanList();
}
/* Cambia el plan activo. `mark`: la estructura dejó de ser la del split original */
const editPlan = (fn, mark = true) => update((st) => { const p = st.plans.find((x) => x.id === st.activePlan); fn(p, st); if (mark) p.edited = true; });
function canChangePlan() {
  const c = S().current;
  if (c && c.started) { toast('Terminá o descartá el entrenamiento en curso antes de cambiar de plan'); return false; }
  return true;
}
function activatePlan(id) {
  if (!canChangePlan()) return;
  update((st) => { st.activePlan = id; st.rot = { done: [], pin: null }; st.current = null; });
  toast('Usás ' + plan().name + '. Arrancás por ' + plan().days[0].n);
  pv = { mode: 'list' }; renderPlan(); $('#main').scrollTop = 0;
}
const volRow = (m, a) => `<div class="vol"><span>${m.n}</span><div class="bar" style="height:8px"><i style="width:${Math.min(100, a / m.target * 100)}%;background:${a >= m.target ? 'var(--green)' : 'var(--pink)'}"></i></div><span>${a}/${m.target}</span></div>`;
let delArm = { id: null, t: 0 };
const armed = (id) => { if (delArm.id === id && Date.now() - delArm.t < 4000) return true; delArm = { id, t: Date.now() }; return false; };

function renderPlanList() {
  const p = plan(), nd = nextDay(), ws = PL.weeklySets(p), adv = PL.reviewPlan(p), others = S().plans.filter((x) => x.id !== p.id);
  $('#planCrumb').textContent = 'Mi plan';
  $('#planBody').innerHTML = `
    <div>
      <div class="planmeta"><span class="pill ${TYPE_PILL[p.type]}">${PLAN_TYPES[p.type].n}</span><span>${p.days.length} días por semana · ${esc(PL.splitLabel(p))}${p.edited && p.type !== 'manual' ? ' · editado' : ''}</span></div>
      <input class="titlein" id="planName" value="${esc(p.name)}" maxlength="40" aria-label="Nombre del plan">
      <p class="sub" style="margin:6px 0 0;font-size:13px">Meta semanal: ${p.days.length} entrenamientos. Tocá un día para editarlo.</p>
    </div>
    <div>
      <h2>Rotación</h2>
      <p class="sub small">Hacés los días en este orden. Si un día no entrenás, el que toca te espera.</p>
      <div class="pdays">${p.days.map((d, i) => `
        <div class="pday">
          <button class="pday-main" data-edit="${d.id}">
            <span class="pday-n">${i + 1}</span>
            <span class="pday-txt">
              <span class="pday-t"><b>${esc(d.n)}</b>${d.id === nd.id ? '<span class="pill p-almost">Toca</span>' : S().rot.done.includes(d.id) ? '<span class="pill p-line">Hecho</span>' : ''}</span>
              ${d.t ? `<span class="pday-sub">${esc(d.t)}</span>` : ''}
              <span class="pday-ex">${d.slots.length ? d.slots.map((s) => EXERCISES[s.opts[0].id].n).join(' · ') : 'Sin ejercicios todavía'}</span>
              <span class="pday-meta">${d.slots.length} ejercicios · ${d.slots.reduce((a, s) => a + s.opts[0].sets, 0)} series · ≈ ${PL.estMinutes(d)} min</span>
            </span>
            <span class="ms" aria-hidden="true">chevron_right</span>
          </button>
          <div class="pday-ord">
            <button data-mv="${i}" data-d="-1" aria-label="Mover ${esc(d.n)} antes" ${i === 0 ? 'disabled' : ''}><span class="ms">arrow_upward</span></button>
            <button data-mv="${i}" data-d="1" aria-label="Mover ${esc(d.n)} después" ${i === p.days.length - 1 ? 'disabled' : ''}><span class="ms">arrow_downward</span></button>
          </div>
        </div>`).join('')}</div>
      ${p.days.length < MAX_DAYS ? '<button class="btn wide" id="addDay"><span class="ms">add</span> Agregar un día</button>' : `<p class="sub small" style="margin-top:10px">Llegaste al máximo de ${MAX_DAYS} días.</p>`}
    </div>
    <div>
      <h2>Series por semana</h2>
      <p class="sub small">Lo que suma una vuelta completa del plan, contra la meta de cada músculo.</p>
      ${MUSCLES.map((m) => volRow(m, ws[m.id] || 0)).join('')}
    </div>
    <div>
      <h2>Recomendaciones</h2>
      <div class="advices">${adv.length ? adv.map((a) => `<div class="advice ${a.lvl}"><span class="ms">${a.lvl === 'warn' ? 'warning' : 'lightbulb'}</span><span>${esc(a.t)}</span></div>`).join('')
        : '<div class="advice ok"><span class="ms">check_circle</span><span>El plan está equilibrado: cada músculo tiene sus series y ninguno se repite en días seguidos.</span></div>'}</div>
    </div>
    <div>
      <h2>Cambiar de plan</h2>
      <button class="cta" id="newPlan"><span>Armar un plan nuevo<br><span style="font-weight:400;font-size:13px">Elegís tipo, días y división. Este queda guardado.</span></span><span class="ms">add</span></button>
      ${others.length ? `<div style="margin-top:12px">${others.map((x) => `
        <div class="row"><span>${esc(x.name)}<span class="hint">${PLAN_TYPES[x.type].n} · ${x.days.length} días · ${sessions().filter((s) => s.planId === x.id).length} entrenamientos</span></span>
          <span class="setrow" style="flex:none"><button class="btn sm" data-use="${x.id}">Usar</button><button class="btn sm danger" data-del="${x.id}">Borrar</button></span></div>`).join('')}</div>` : ''}
    </div>`;
  $('#planName').onchange = (ev) => { const v = ev.target.value.trim(); editPlan((q) => { q.name = v || PL.defaultName(q.type, q.days.length); }, false); toast('Nombre guardado'); };
  $$('[data-edit]').forEach((b) => (b.onclick = () => { pv = { mode: 'day', dayId: b.dataset.edit }; renderPlan(); $('#main').scrollTop = 0; }));
  $$('[data-mv]').forEach((b) => (b.onclick = () => {
    const i = +b.dataset.mv, j = i + +b.dataset.d;
    editPlan((q) => { [q.days[i], q.days[j]] = [q.days[j], q.days[i]]; });
    renderPlan();
    const f = $(`[data-mv="${j}"][data-d="${b.dataset.d}"]`); (f && !f.disabled ? f : $(`[data-mv="${j}"]`)).focus();
  }));
  const ad = $('#addDay');
  if (ad) ad.onclick = () => {
    const d = PL.newDay('Día ' + (plan().days.length + 1));
    editPlan((q) => { q.days.push(d); });
    pv = { mode: 'day', dayId: d.id }; renderPlan(); $('#main').scrollTop = 0;
  };
  $('#newPlan').onclick = () => { if (!canChangePlan()) return; pv = { mode: 'wizard', step: 1, type: 'fuerza', days: p.days.length, split: null, name: '', names: [] }; renderPlan(); $('#main').scrollTop = 0; };
  $$('[data-use]').forEach((b) => (b.onclick = () => activatePlan(b.dataset.use)));
  $$('[data-del]').forEach((b) => (b.onclick = () => {
    if (!armed('plan' + b.dataset.del)) { b.textContent = '¿Seguro?'; return; }
    update((st) => { st.plans = st.plans.filter((x) => x.id !== b.dataset.del); });
    toast('Plan borrado. Sus entrenamientos siguen en el historial'); renderPlan();
  }));
}

function renderWizard() {
  const w = pv;
  $('#planCrumb').textContent = 'Plan nuevo · paso ' + w.step + ' de 3';
  let body = '';
  if (w.step === 1) {
    body = `<h1 class="h1">¿Qué tipo de entrenamiento?</h1><div class="choices" role="radiogroup" aria-label="Tipo de plan">${Object.entries(PLAN_TYPES).map(([k, t]) => `
      <button class="choice" role="radio" data-type="${k}" aria-checked="${w.type === k}" ${t.soon ? 'disabled' : ''}>
        <span class="ms choice-ic">${t.ic}</span>
        <span class="choice-txt"><b>${t.n}${t.soon ? ' <span class="pill p-line">Próximamente</span>' : ''}</b><span>${t.d}</span></span>
      </button>`).join('')}</div>`;
  } else if (w.step === 2) {
    body = `<h1 class="h1">¿Cuántos días por semana?</h1>
      <div class="seg bigseg" role="group" aria-label="Días por semana">${[2, 3, 4, 5].map((n) => `<button data-wd="${n}" aria-pressed="${w.days === n}">${n}</button>`).join('')}</div>
      <p class="sub">Tu meta semanal pasa a ser <b style="color:var(--text);font-weight:500">${w.days} entrenamientos</b>. Los días rotan: si un día no entrenás, el que toca te espera.</p>`;
  } else if (w.type === 'manual') {
    w.names = Array.from({ length: w.days }, (_, i) => w.names[i] ?? 'Día ' + (i + 1));
    body = `<h1 class="h1">Poné nombre a tus días</h1>
      <p class="sub" style="margin:-8px 0 0">Después, en cada día, elegís los ejercicios del catálogo con sus series, repeticiones, RIR y descanso.</p>
      <div class="grid2">${w.names.map((n, i) => `<label class="field"><span>Día ${i + 1}</span><input data-wn="${i}" maxlength="24" value="${esc(n)}"></label>`).join('')}</div>
      <label class="field"><span>Nombre del plan</span><input id="wzName" maxlength="40" placeholder="${esc(PL.defaultName('manual', w.days))}" value="${esc(w.name)}"></label>`;
  } else {
    const sps = PL.splitsFor(w.days);
    if (!sps.some((x) => x.id === w.split)) w.split = sps[0].id;
    body = `<h1 class="h1">¿Cómo repartimos los días?</h1>
      <div class="choices" role="radiogroup" aria-label="División">${sps.map((sp, i) => `
        <button class="choice" role="radio" data-split="${sp.id}" aria-checked="${w.split === sp.id}">
          <span class="choice-txt"><b>${sp.n}${i === 0 ? ' <span class="pill p-almost">Recomendado</span>' : ''}</b><span>${sp.d}</span>
          <span class="choice-days">${PL.splitDayNames(sp).map((n, j) => `<i>${j + 1}</i>${esc(n)}`).join(' ')}</span></span>
        </button>`).join('')}</div>
      <p class="sub small" style="margin:-8px 0 0">Después podés cambiar cualquier ejercicio, series o repeticiones.</p>
      <label class="field"><span>Nombre del plan</span><input id="wzName" maxlength="40" placeholder="${esc(PL.defaultName(w.type, w.days))}" value="${esc(w.name)}"></label>`;
  }
  $('#planBody').innerHTML = body + `<div class="setrow"><button class="btn" id="wzBack">${w.step === 1 ? 'Cancelar' : 'Atrás'}</button><button class="btn solid" id="wzNext">${w.step === 3 ? 'Crear y usar este plan' : 'Siguiente'}</button></div>`;
  $$('[data-type]').forEach((b) => (b.onclick = () => { w.type = b.dataset.type; renderWizard(); $(`[data-type="${w.type}"]`).focus(); }));
  $$('[data-wd]').forEach((b) => (b.onclick = () => { w.days = +b.dataset.wd; renderWizard(); $(`[data-wd="${w.days}"]`).focus(); }));
  $$('[data-split]').forEach((b) => (b.onclick = () => { w.split = b.dataset.split; renderWizard(); $(`[data-split="${w.split}"]`).focus(); }));
  $$('[data-wn]').forEach((i) => (i.oninput = () => { w.names[+i.dataset.wn] = i.value; }));
  if ($('#wzName')) $('#wzName').oninput = (ev) => { w.name = ev.target.value; };
  $('#wzBack').onclick = () => { if (w.step === 1) pv = { mode: 'list' }; else w.step--; renderPlan(); };
  $('#wzNext').onclick = () => {
    if (w.step < 3) { w.step++; renderWizard(); $('#main').scrollTop = 0; return; }
    if (!canChangePlan()) return;
    const np = PL.newPlan(w.type, w.days, w.split, w.name);
    if (w.type === 'manual') np.days.forEach((d, i) => { d.n = (w.names[i] || '').trim() || 'Día ' + (i + 1); });
    update((st) => { st.plans.push(np); st.activePlan = np.id; st.rot = { done: [], pin: null }; st.current = null; });
    toast('Plan creado. Arrancás por ' + np.days[0].n);
    pv = w.type === 'manual' ? { mode: 'day', dayId: np.days[0].id } : { mode: 'list' };
    renderPlan(); $('#main').scrollTop = 0;
  };
}

const STEP = { sets: [1, 10, 1, 'Series'], reps: [1, 30, 1, 'Reps'], rir: [0, 5, 1, 'RIR'], rest: [30, 300, 15, 'Descanso'] };
function renderDayEditor() {
  const p = plan(), i = p.days.findIndex((d) => d.id === pv.dayId), d = p.days[i];
  const editDay = (fn, mark) => editPlan((q) => fn(q.days.find((x) => x.id === d.id)), mark);
  $('#planCrumb').textContent = 'Día ' + (i + 1) + ' de ' + p.days.length;
  const stepper = (si, f, o, name) => {
    const [, , , lbl] = STEP[f];
    return `<div class="step"><span class="step-l">${lbl}</span><div class="step-c">
      <button data-st="${si}" data-f="${f}" data-d="-1" aria-label="Menos ${lbl.toLowerCase()} en ${name}"><span class="ms">remove</span></button>
      <b>${f === 'rest' ? mss(o[f]) : o[f]}</b>
      <button data-st="${si}" data-f="${f}" data-d="1" aria-label="Más ${lbl.toLowerCase()} en ${name}"><span class="ms">add</span></button></div></div>`;
  };
  $('#planBody').innerHTML = `
    <div class="grid2">
      <label class="field"><span>Nombre del día</span><input id="dName" maxlength="24" value="${esc(d.n)}"></label>
      <label class="field"><span>Descripción</span><input id="dT" maxlength="40" value="${esc(d.t || '')}" placeholder="Opcional"></label>
    </div>
    <p class="sub" style="margin:-8px 0 0;font-size:13px">${d.slots.length} ejercicios · ${d.slots.reduce((a, s) => a + s.opts[0].sets, 0)} series · ≈ ${PL.estMinutes(d)} min con la entrada en calor</p>
    <div class="pslots">${d.slots.map((s, si) => { const o = s.opts[0], name = EXERCISES[o.id].n; return `
      <div class="pslot">
        <div class="pslot-h"><span class="slot-lbl">${si + 1} · ${esc(s.p)}</span>
          <span class="pslot-ord">
            <button data-smv="${si}" data-d="-1" aria-label="Subir ${name}" ${si === 0 ? 'disabled' : ''}><span class="ms">arrow_upward</span></button>
            <button data-smv="${si}" data-d="1" aria-label="Bajar ${name}" ${si === d.slots.length - 1 ? 'disabled' : ''}><span class="ms">arrow_downward</span></button>
            <button data-sdel="${si}" aria-label="Quitar ${name}"><span class="ms">delete</span></button>
          </span></div>
        <button class="ex-pick" data-spick="${si}" aria-label="Cambiar ${name}"><span class="ex-name">${name}</span><span class="ms">expand_more</span></button>
        <div class="steps">${['sets', 'reps', 'rir', 'rest'].map((f) => stepper(si, f, o, name)).join('')}</div>
        ${s.opts.length > 1 ? `<p class="pslot-alt">Para cambiar en el momento: ${s.opts.slice(1).map((x) => EXERCISES[x.id].n).join(', ')}</p>` : ''}
      </div>`; }).join('')}</div>
    ${d.slots.length ? '' : '<p class="empty">Todavía no hay ejercicios. Agregá el primero desde el catálogo.</p>'}
    <button class="cta" id="addEx" style="justify-content:center;gap:8px"><span class="ms">add</span>Agregar ejercicio</button>
    <p class="sub small" style="margin:0">Los cambios se guardan solos y se aplican desde el próximo entrenamiento. Si tenés uno en curso, ese no cambia.</p>
    ${p.days.length > MIN_DAYS ? '<button class="btn danger" id="delDay">Borrar este día</button>' : ''}`;
  $('#dName').onchange = (ev) => { const v = ev.target.value.trim(); editDay((x) => { x.n = v || 'Día ' + (i + 1); }, false); toast('Nombre guardado'); };
  $('#dT').onchange = (ev) => { editDay((x) => { x.t = ev.target.value.trim(); }, false); };
  $$('[data-st]').forEach((b) => (b.onclick = () => {
    const si = +b.dataset.st, f = b.dataset.f, [lo, hi, stp] = STEP[f];
    editDay((x) => { const o = x.slots[si].opts[0]; o[f] = Math.min(hi, Math.max(lo, o[f] + stp * +b.dataset.d)); });
    renderDayEditor(); $(`[data-st="${si}"][data-f="${f}"][data-d="${b.dataset.d}"]`).focus();
  }));
  $$('[data-smv]').forEach((b) => (b.onclick = () => {
    const si = +b.dataset.smv, sj = si + +b.dataset.d;
    editDay((x) => { [x.slots[si], x.slots[sj]] = [x.slots[sj], x.slots[si]]; });
    renderDayEditor(); const f = $(`[data-smv="${sj}"][data-d="${b.dataset.d}"]`); (f && !f.disabled ? f : $(`[data-smv="${sj}"]`)).focus();
  }));
  $$('[data-sdel]').forEach((b) => (b.onclick = () => {
    const si = +b.dataset.sdel, n = EXERCISES[d.slots[si].opts[0].id].n;
    editDay((x) => { x.slots.splice(si, 1); }); renderDayEditor(); toast('Quitaste ' + n);
  }));
  const used = new Set(d.slots.map((s) => s.opts[0].id));
  $$('[data-spick]').forEach((b) => (b.onclick = () => {
    const si = +b.dataset.spick, cur = d.slots[si].opts[0].id;
    openCatalog('Cambiar ' + EXERCISES[cur].n, cur, used, (id) => {
      if (id === cur) return;
      editDay((x) => { x.slots[si] = PL.setSlotExercise(x.slots[si], id); });
      renderDayEditor(); toast('Cambiaste ' + EXERCISES[cur].n + ' por ' + EXERCISES[id].n);
    });
  }));
  $('#addEx').onclick = () => openCatalog('Agregar ejercicio', null, used, (id) => {
    editDay((x) => { x.slots.push(PL.makeSlot(id)); });
    renderDayEditor(); toast('Agregaste ' + EXERCISES[id].n);
    $('#addEx').scrollIntoView({ block: 'center' });
  });
  const dd = $('#delDay');
  if (dd) dd.onclick = () => {
    if (!armed('day' + d.id)) { dd.textContent = 'Tocá de nuevo para borrar ' + d.n; return; }
    editPlan((q, st) => { q.days = q.days.filter((x) => x.id !== d.id); st.rot.done = st.rot.done.filter((x) => x !== d.id); if (st.rot.pin === d.id) st.rot.pin = null; });
    toast('Borraste ' + d.n); pv = { mode: 'list' }; renderPlan(); $('#main').scrollTop = 0;
  };
}

/* Catálogo de ejercicios agrupado por músculo principal */
let catCb = null, catCur = null, catUsed = new Set();
const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function openCatalog(title, cur, used, cb) {
  catCb = cb; catCur = cur; catUsed = used;
  $('#catT').textContent = title; $('#catQ').value = '';
  paintCatalog(); $('#cat').hidden = false; $('#sheetBg').hidden = false;
  $('#catList').scrollTop = 0;
}
function closeCatalog() { if ($('#cat').hidden) return; $('#cat').hidden = true; $('#sheetBg').hidden = true; catCb = null; }
function paintCatalog() {
  const q = norm($('#catQ').value.trim());
  const html = MUSCLES.map((m) => {
    const ids = Object.keys(EXERCISES).filter((id) => EXERCISES[id].m[0] === m.id && (!q || norm(EXERCISES[id].n).includes(q)));
    if (!ids.length) return '';
    return `<div class="picker-h">${m.n}</div>` + ids.map((id) => `
      <button class="opt" data-cat="${id}" aria-selected="${id === catCur}">
        <span class="opt-main"><span class="opt-n">${EXERCISES[id].n}</span><span class="opt-why">${EXERCISES[id].m.map((x) => MUSCLES.find((y) => y.id === x).n.toLowerCase()).join(', ')}${catUsed.has(id) && id !== catCur ? ' · ya está en este día' : ''}</span></span>
        <span></span><span class="ms opt-chk" aria-hidden="true">${id === catCur ? 'check_circle' : 'add_circle'}</span>
      </button>`).join('');
  }).join('');
  $('#catList').innerHTML = html || '<p class="empty">No encontré ejercicios con ese nombre.</p>';
  $$('[data-cat]').forEach((b) => (b.onclick = () => { const cb = catCb; closeCatalog(); if (cb) cb(b.dataset.cat); }));
}
$('#catQ').oninput = paintCatalog;
$('#catX').onclick = closeCatalog;

/* ---------- AJUSTES ---------- */
function renderAjustes() {
  const p = S().profile, st = S().settings;
  $('#apiKey').value = st.apiKey; $('#apiKey').type = 'password'; $('#keyShow').textContent = 'Mostrar';
  $('#keyStatus').textContent = st.apiKey ? 'Clave cargada.' : 'Sin clave: el coach no funciona y las comidas se calculan con la tabla.';
  $('#modelSel').innerHTML = Object.entries(AI.MODELS).map(([id, m]) => `<option value="${id}" ${id === st.model ? 'selected' : ''}>${m.label} · ${m.note}</option>`).join('');
  $('#sexSel').value = p.sex; $('#voiceChk').checked = !!st.voice;
  $('#gKcal').value = p.goals.kcal; $('#gProt').value = p.goals.p; $('#gCarb').value = p.goals.c; $('#gFat').value = p.goals.g;
  $('#ormFields').innerHTML = MAIN_LIFTS.map((l) => `<label class="field"><span>${l.n}</span><input data-orm="${l.id}" type="number" inputmode="decimal" step="2.5" value="${p.orm[l.id] || ''}"></label>`).join('');
  const kb = new Blob([localStorage.getItem('carga:v1') || '']).size;
  $('#storeInfo').textContent = `${sessions().length} entrenamientos, ${S().runs.length} carreras, ${S().meals.length} comidas guardadas (${fmt(kb / 1024, 0)} KB).` + (canPersist() ? '' : ' Atención: no se pudo guardar el último cambio.');
  const pn = plan(), nd = nextDay();
  $('#setPlanName').textContent = pn.name;
  $('#setPlanSub').textContent = PLAN_TYPES[pn.type].n + ' · ' + pn.days.length + ' días por semana · ' + PL.splitLabel(pn);
  $('#nextSel').innerHTML = pn.days.map((d, i) => `<option value="${d.id}" ${d.id === nd.id ? 'selected' : ''}>${i + 1} · ${esc(d.n)}</option>`).join('');
  $('#versionLbl').textContent = 'Carga ' + VERSION;
  renderNotif();
}
function renderNotif() {
  const p = 'Notification' in window ? Notification.permission : 'unsupported';
  $('#notifStatus').textContent = {
    granted: 'Avisos activados: con el celular bloqueado te avisa cuando termina un descanso o cambia un intervalo.',
    denied: 'Avisos bloqueados. Activalos en los ajustes de Chrome → Configuración del sitio → Notificaciones.',
    default: 'Activá los avisos para enterarte con el celular bloqueado de que terminó un descanso.',
    unsupported: 'Este navegador no permite avisos.',
  }[p];
  $('#notifBtn').hidden = p !== 'default';
}
$('#notifBtn').onclick = async () => { try { await Notification.requestPermission(); } catch (e) {} renderNotif(); };
$('#keyShow').onclick = () => { const i = $('#apiKey'); i.type = i.type === 'password' ? 'text' : 'password'; $('#keyShow').textContent = i.type === 'password' ? 'Mostrar' : 'Ocultar'; };
$('#modelSel').onchange = () => { update((st) => { st.settings.model = $('#modelSel').value; }); toast('Modelo: ' + AI.MODELS[S().settings.model].label); };
$('#keySave').onclick = async () => {
  const k = $('#apiKey').value.trim();
  update((st) => { st.settings.apiKey = k; });
  if (!k) { $('#keyStatus').textContent = 'Clave borrada.'; return; }
  $('#keyStatus').textContent = 'Probando la clave…';
  try { await AI.testKey(k); $('#keyStatus').textContent = 'Clave guardada y funcionando.'; toast('Clave de API lista'); }
  catch (e) { $('#keyStatus').textContent = 'Clave guardada, pero la prueba falló: ' + (await AI.explainError(e)); }
};
$('#profSave').onclick = () => {
  const g = { kcal: num($('#gKcal').value), p: num($('#gProt').value), c: num($('#gCarb').value), g: num($('#gFat').value) };
  if (Object.values(g).some((v) => !(v > 0))) { toast('Revisá las metas de nutrición'); return; }
  update((st) => {
    st.profile.sex = $('#sexSel').value; st.profile.goals = g; st.settings.voice = $('#voiceChk').checked;
    $$('[data-orm]').forEach((i) => { const v = num(i.value); if (v > 0) st.profile.orm[i.dataset.orm] = v; else delete st.profile.orm[i.dataset.orm]; });
  });
  toast('Cambios guardados');
};
/* Elegir a mano el próximo día: queda fijo hasta que termines un entrenamiento */
$('#nextSel').onchange = () => {
  const id = $('#nextSel').value;
  update((st) => { st.rot.pin = id; if (st.current && !st.current.started) st.current = null; });
  toast('Próximo entrenamiento: ' + plan().days.find((d) => d.id === id).n);
};
$('#expBtn').onclick = () => {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'carga-copia-' + todayK() + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Copia descargada');
};
$('#impBtn').onclick = () => $('#impFile').click();
$('#impFile').onchange = async () => {
  const f = $('#impFile').files[0]; if (!f) return;
  try { importJSON(await f.text()); ensurePlan(); toast('Copia cargada'); bwDraft = null; renderAjustes(); }
  catch (e) { toast(e.message || 'No se pudo leer el archivo'); }
  $('#impFile').value = '';
};
$('#resetBtn').onclick = () => { $('#resetConfirm').hidden = false; };
$('#resetNo').onclick = () => { $('#resetConfirm').hidden = true; };
$('#resetYes').onclick = () => { resetAll(); $('#resetConfirm').hidden = true; bwDraft = null; showOnboarding(); };

/* ---------- botón + ---------- */
function sheet(open) { $('#sheet').hidden = !open; $('#sheetBg').hidden = !open; $('#fab').setAttribute('aria-expanded', open); $('#fab').classList.toggle('open', open); }
$('#fab').onclick = () => sheet($('#sheet').hidden);
$('#sheetBg').onclick = () => { sheet(false); openSurvey(false); closeCatalog(); closeSess(); };
$('#sheetX').onclick = () => sheet(false);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { sheet(false); openSurvey(false); closeCatalog(); closeSess(); } });
$$('[data-act]').forEach((b) => (b.onclick = () => {
  sheet(false);
  const a = b.dataset.act;
  if (a === 'comida') { go('nutricion'); setTimeout(() => $('#foodIn').focus(), 50); }
  else if (a === 'peso') { go('hoy'); $('#bwVal').scrollIntoView({ block: 'center' }); }
  else if (a === 'entrenar') go('entrenar');
  else if (a === 'carrera') { go('correr'); if (!run.on) toggleRun(); }
  else if (a === 'descanso') { go('correr'); $('#timerBox').scrollIntoView({ block: 'center' }); }
  else if (a === 'coach') { go('coach'); setTimeout(() => $('#chatIn').focus(), 50); }
}));

/* ---------- configuración inicial ---------- */
function showOnboarding() {
  $('#onboard').hidden = false;
  paintObDays();
  $('#obOrm').innerHTML = MAIN_LIFTS.map((l) => `<label class="field"><span>${l.n}</span><input data-oborm="${l.id}" type="number" inputmode="decimal" step="2.5" placeholder="kg"></label>`).join('');
}
let obDays = 3;
function paintObDays() {
  $('#obDays').innerHTML = [2, 3, 4, 5].map((n) => `<button data-obd="${n}" aria-pressed="${n === obDays}">${n}</button>`).join('');
  $$('[data-obd]').forEach((b) => (b.onclick = () => { obDays = +b.dataset.obd; paintObDays(); }));
  $('#obDaysTxt').textContent = 'Arrancás con Fuerza · ' + obDays + ' días: ' + PL.splitsFor(obDays)[0].n + '. Después lo cambiás en Mi plan.';
}
$('#obBw').oninput = () => ($('#obErr').hidden = true);
$('#obGo').onclick = () => {
  const bw = num($('#obBw').value);
  if (!(bw > 25 && bw < 300)) { $('#obErr').hidden = false; return; }
  const orm = {};
  $$('[data-oborm]').forEach((i) => { const v = num(i.value); if (v > 0) orm[i.dataset.oborm] = v; });
  const p = Math.round(bw * 2), g = Math.round(bw), kcal = Math.round(bw * 33 / 50) * 50;
  update((st) => {
    st.profile = { bw, sex: $('#obSex').value, orm, goals: { kcal, p, g, c: Math.max(100, Math.round((kcal - p * 4 - g * 9) / 4)) }, created: new Date().toISOString() };
    st.bodyweight.push({ d: todayK(), kg: bw });
    const pn = PL.newPlan('fuerza', obDays);
    st.plans = [pn]; st.activePlan = pn.id; st.rot = { done: [], pin: null }; st.current = null;
  });
  requestPersistence();
  $('#onboard').hidden = true; bwDraft = null;
  go('hoy');
  toast('Listo. Cargá tu clave de API en Ajustes para usar la IA');
};

/* ---------- arranque ---------- */
const RENDER = { hoy: renderHoy, entrenar: renderEntrenar, correr: renderCorrer, progreso: renderProgreso, nutricion: renderNutricion, coach: renderCoach, ajustes: renderAjustes, plan: renderPlan };
if (!S().profile) showOnboarding();
else { ensurePlan(); go(location.hash.slice(1) || 'hoy'); restoreRunSnap(); if (run.on) bgHold('run', true); }
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
