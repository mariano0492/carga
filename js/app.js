import { MUSCLES, EXERCISES, MAIN_LIFTS, PROGRAM, DAY_ORDER, LEVELS, STANDARDS, FOODS, RECIPES, QUOTES, SONGS } from './data.js';
import { S, save, update, dateKey, exportJSON, importJSON, resetAll, requestPersistence, canPersist } from './store.js';
import * as AI from './ai.js';

const VERSION = '1.0.0';

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
  if (document.visibilityState === 'visible' && (run.on || (S().current && S().current.started))) keepAwake(true);
});

/* ---------- navegación ---------- */
const SCREENS = ['hoy', 'entrenar', 'correr', 'progreso', 'nutricion', 'coach', 'ajustes'];
let screen = 'hoy';
function go(tab) {
  if (!SCREENS.includes(tab)) tab = 'hoy';
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

/* ---------- recuperación muscular ---------- */
function muscleStatus() {
  const now = Date.now();
  return MUSCLES.filter((m) => m.fig).map((m) => {
    let last = null, what = '';
    for (const s of sessions()) {
      const hit = s.sets.find((x) => (EXERCISES[x.ex]?.m || []).includes(m.id));
      if (hit && (!last || new Date(s.date) > last)) { last = new Date(s.date); what = EXERCISES[hit.ex].n; }
    }
    if (m.id === 'pant') for (const r of S().runs) if (!last || new Date(r.date) > last) { last = new Date(r.date); what = 'carrera ' + fmt(r.dist / 1000, 1) + ' km'; }
    const h = last ? Math.floor((now - last) / H) : Infinity;
    const left = last ? m.need - h : 0;
    const st = left <= 0 ? 'ready' : left <= 12 ? 'almost' : 'rest';
    return { ...m, h, left, st, lastTxt: last ? shortDate(last) + ' · ' + what : 'Sin registros todavía' };
  });
}
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
    const pct = m.h === Infinity ? 100 : Math.min(100, Math.round(m.h / m.need * 100));
    const cls = { ready: 'p-ready', almost: 'p-almost', rest: 'p-rest' }[m.st];
    return `<div class="recov"><div><div>${m.n}</div><div class="sub" style="font-size:12.5px">${esc(m.lastTxt)}</div></div><span class="pill ${cls}">${m.st === 'ready' ? 'listo' : m.left + ' h más'}</span><div class="bar"><i style="width:${pct}%;background:${mFill[m.st]}"></i></div></div>`;
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
function streak() {
  let n = weekCount(0) >= 3 ? 1 : 0;
  for (let w = 1; w < 200 && weekCount(w) >= 3; w++) n++;
  return n;
}
let bwDraft = null;
function renderHoy() {
  const d = new Date();
  $('#todayLbl').textContent = WD_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
  showQuote(); showSong(); renderRecovery(); renderWellness();
  const cur = S().current;
  const day = cur ? cur.day : S().nextDay, P = PROGRAM[day];
  if (cur && cur.started) {
    const done = Object.values(cur.sets).filter((x) => x.done).length;
    $('#todayCta').innerHTML = `<span>Seguir entrenamiento · ${P.n}<br><span style="font-weight:400;font-size:13px">${done} series hechas</span></span><span class="ms">play_arrow</span>`;
  } else {
    const first = P.slots[0].opts[0];
    $('#todayCta').innerHTML = `<span>Hoy toca: ${P.n} · ${P.t}<br><span style="font-weight:400;font-size:13px">${EXERCISES[first.id].n} ${first.sets}×${first.reps} · ${P.slots.length} ejercicios</span></span><span class="ms">play_arrow</span>`;
  }
  $('#weekStat').textContent = weekCount() + '/3';
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
  const lv = rdLevel();
  if (lv.f < 1 && !e.band && kg > 0) {
    const adj = roundTo(kg * lv.f, e.perHand ? 2 : 2.5);
    if (adj < kg) { why += ` Tu puntaje de hoy es ${readiness()}: bajamos ${Math.round((1 - lv.f) * 100)}% (${kgLabel(e, kg)} → ${kgLabel(e, adj)}).`; kg = adj; tag = 'down'; }
  }
  return { kg, tag, why, prev, inc };
}
const tagTxt = (p) => (p.tag === 'up' ? '+' + fmt(p.inc) + ' kg' : p.tag === 'down' ? 'baja' : p.tag === 'first' ? 'primera vez' : 'igual');

function ensureCurrent() {
  if (!S().current) update((st) => { st.current = { day: st.nextDay, started: null, sel: PROGRAM[st.nextDay].slots.map(() => 0), sets: {} }; });
  return S().current;
}
const curOpt = (ei) => { const c = S().current; return PROGRAM[c.day].slots[ei].opts[c.sel[ei]]; };
const doneCount = () => Object.values(S().current.sets).filter((x) => x.done).length;

let clockT = null;
function renderEntrenar() {
  const c = ensureCurrent(), P = PROGRAM[c.day];
  $('#wkTitle').textContent = P.n + ' · ' + P.t;
  $('#dayPick').innerHTML = DAY_ORDER.map((d) => `<button data-day="${d}" aria-pressed="${d === c.day}">${PROGRAM[d].n}</button>`).join('');
  $$('[data-day]').forEach((b) => (b.onclick = () => {
    if (b.dataset.day === c.day) return;
    if (doneCount()) { toast('Ya empezaste este día. Terminalo o descartalo para cambiar.'); return; }
    update((st) => { st.current = { day: b.dataset.day, started: null, sel: PROGRAM[b.dataset.day].slots.map(() => 0), sets: {} }; });
    renderEntrenar();
  }));
  $('#exList').innerHTML = P.slots.map((_, ei) => `<div class="ex" id="ex${ei}"></div>`).join('');
  P.slots.forEach((_, ei) => renderEx(ei));
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
function renderEx(ei) {
  const c = S().current, slot = PROGRAM[c.day].slots[ei], opt = curOpt(ei), e = EXERCISES[opt.id], plan0 = EXERCISES[slot.opts[0].id], pl = planOf(opt);
  $('#setsTotal').textContent = PROGRAM[c.day].slots.reduce((a, _, i) => a + curOpt(i).sets, 0);
  const val = (si, k, def) => { const v = c.sets[ei + '-' + si]; return v && v[k] != null && v[k] !== '' ? v[k] : def; };
  $('#ex' + ei).innerHTML = `
    <div class="slot-lbl">${ei + 1} · ${slot.p} <span>· ${slot.m}</span></div>
    <div class="ex-head">
      <button class="ex-pick" aria-expanded="false" aria-controls="pick${ei}"><span class="ex-name">${e.n}</span><span class="ms">expand_more</span></button>
      <button class="tipbtn" aria-expanded="false" aria-controls="tip${ei}" aria-label="Consejo de técnica"><span class="ms">lightbulb</span></button>
    </div>
    <div class="picker" id="pick${ei}" role="listbox" aria-label="Elegir ejercicio de ${slot.p.toLowerCase()}" hidden>
      <div class="picker-h">Ejercicios similares · ${slot.m}</div>
      ${slot.opts.map((o, oi) => `
        <button class="opt" role="option" aria-selected="${oi === c.sel[ei]}" data-opt="${oi}">
          <span class="opt-main"><span class="opt-n">${EXERCISES[o.id].n}</span><span class="opt-why">${oi === 0 ? 'Del plan de hoy' : o.why}</span></span>
          <span class="opt-side">${o.rec ? '<span class="pill p-almost">Recomendado</span>' : ''}<span class="opt-sch">${o.sets}×${o.reps} · ${kgLabel(EXERCISES[o.id], planOf(o).kg)}</span></span>
          <span class="ms opt-chk" aria-hidden="true">${oi === c.sel[ei] ? 'check_circle' : 'radio_button_unchecked'}</span>
        </button>`).join('')}
    </div>
    ${c.sel[ei] ? `<div class="swapnote"><span class="ms" style="font-size:18px">swap_horiz</span><span>Reemplaza a <b>${plan0.n}</b>. Sigue trabajando ${slot.m}.</span><button data-back="1">Volver al plan</button></div>` : ''}
    <div class="ex-meta">${opt.sets}×${opt.reps} · RIR ${opt.rir} · descanso ${mss(opt.rest)}</div>
    <div class="tip" id="tip${ei}" hidden>${e.tip}</div>
    <button class="why" aria-expanded="false" aria-controls="why${ei}">
      <span class="ms" style="font-size:16px;color:var(--pink)">auto_awesome</span>
      <span>Hoy: <b>${kgLabel(e, pl.kg)}</b></span><span class="tag tag-${pl.tag === 'first' ? 'same' : pl.tag}">${tagTxt(pl)}</span><span class="why-q">¿Por qué?</span>
    </button>
    <div class="rule" id="why${ei}" hidden>
      <p>${pl.why}</p>
      <p class="rule-base">Regla: si completás todas las series con el RIR objetivo, sube ${e.band ? 'la banda' : fmt(pl.inc) + ' kg'}. Si te falta alguna repetición, repetís el peso. Si te faltan 2 o más en una serie, baja 10%.</p>
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
  box.querySelectorAll('input[data-k]').forEach((inp) => (inp.onchange = () => {
    update((st) => { const k = inp.dataset.k; st.current.sets[k] = { ...(st.current.sets[k] || {}), [inp.dataset.f]: inp.value }; });
  }));
  box.querySelectorAll('.chk').forEach((b) => (b.onclick = () => toggleSet(+b.dataset.e, +b.dataset.s)));
}
function swapEx(ei, oi) {
  const c = S().current;
  if (oi === c.sel[ei]) { renderEx(ei); return; }
  const from = EXERCISES[curOpt(ei).id].n;
  const hadDone = Object.keys(c.sets).some((k) => k.startsWith(ei + '-') && c.sets[k].done);
  update((st) => {
    st.current.sel[ei] = oi;
    Object.keys(st.current.sets).forEach((k) => { if (k.startsWith(ei + '-')) delete st.current.sets[k]; });
  });
  renderEx(ei); updateWorkoutStats();
  const to = EXERCISES[curOpt(ei).id].n;
  toast((oi === 0 ? 'Volviste a ' + to : 'Cambiaste ' + from + ' por ' + to) + (hadDone ? '. Las series de este ejercicio se reiniciaron' : ''));
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
  update((st) => {
    st.current.sets[k] = { ...(st.current.sets[k] || {}), kg: $('#w' + k).value, reps: String(reps || ''), rir: String(Number.isFinite(rir) ? rir : ''), done: on, pr, ex: opt.id, kgN: kg, repsN: reps, rirN: Number.isFinite(rir) ? rir : opt.rir };
    if (on && !st.current.started) st.current.started = Date.now();
  });
  if (on) { startRest(opt.rest); keepAwake(true); }
  renderEx(ei); updateWorkoutStats();
  if (on && !clockT) renderEntrenar();
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
  const tick = () => {
    const left = Math.ceil((restEnd - Date.now()) / 1000);
    $('#restClock').textContent = mss(left);
    if (left <= 0) { clearInterval(restT); restEnd = 0; $('#rest').hidden = true; beep(988, 0.2, 3); buzz([200, 100, 200]); toast('Descanso terminado. Siguiente serie'); }
  };
  tick(); restT = setInterval(tick, 500);
}
$('#restPlus').onclick = () => { restEnd += 30e3; };
$('#restSkip').onclick = () => { restEnd = 0; clearInterval(restT); $('#rest').hidden = true; };

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
  const n = sets.length, vol = $('#volTxt').textContent;
  update((st) => {
    st.sessions.push({ id: uid(), date: new Date().toISOString(), day: c.day, dur: Math.round((Date.now() - (c.started || Date.now())) / 1000), sets, survey: { ...survey } });
    st.nextDay = DAY_ORDER[(DAY_ORDER.indexOf(c.day) + 1) % 3];
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
  if (run.on || run.elapsed) resetRun();
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
  if (run.mode === 'int') { run.phaseLeft -= dt; if (run.phaseLeft <= 0) nextPhase(); }
  const km = Math.floor(run.dist / 1000);
  if (km > run.kmSpoken) {
    run.kmSpoken = km;
    const pace = run.elapsed / (run.dist / 1000);
    speak(`Kilómetro ${km}. Ritmo ${Math.floor(pace / 60)} minutos ${Math.round(pace % 60)} segundos.`);
  }
  paintRun();
}
function nextPhase() {
  if (run.phase === 'fast') { run.phase = 'easy'; run.phaseLeft = run.cfg.easy; beep(660, 0.25, 2); buzz([300]); speak('Suave'); }
  else if (run.round >= run.cfg.rounds) { beep(1320, 0.3, 3); buzz([200, 100, 200, 100, 200]); speak('Intervalos completos'); toggleRun(); run.phase = 'done'; toast('Intervalos completos: ' + fmt(run.dist / 1000, 2) + ' km'); }
  else { run.round++; run.phase = 'fast'; run.phaseLeft = run.cfg.fast; beep(1046, 0.2, 2); buzz([150, 80, 150]); speak('Rápido'); }
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
    gpsStart(); keepAwake(true);
    run.last = Date.now(); run.t = setInterval(tick, 250);
    if (!run.elapsed) { beep(1046, 0.15); if (run.mode === 'int') speak('Rápido'); }
  } else { clearInterval(run.t); lastPos = null; }
  paintRun();
}
function resetRun() {
  clearInterval(run.t);
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
  $$('[data-tm]').forEach((b) => (b.onclick = () => { clearInterval(tm.t); Object.assign(tm, { total: +b.dataset.tm, left: +b.dataset.tm, on: false }); paintTimer(); }));
}
function tmTick() {
  const prev = Math.ceil(tm.left);
  tm.left = (tm.end - Date.now()) / 1000;
  const cur = Math.ceil(tm.left);
  if (cur !== prev && cur <= 3 && cur > 0) beep(660, 0.1);
  if (tm.left <= 0) { tm.left = 0; tm.on = false; clearInterval(tm.t); beep(988, 0.25, 3); buzz([200, 100, 200]); toast('Descanso terminado. A seguir'); }
  paintTimer();
}
$('#tmStart').onclick = () => {
  if (tm.left <= 0) tm.left = tm.total;
  tm.on = !tm.on;
  if (tm.on) { tm.end = Date.now() + tm.left * 1000; tm.t = setInterval(tmTick, 200); } else clearInterval(tm.t);
  paintTimer();
};
$('#tmPlus').onclick = () => { tm.left += 15; tm.end += 15e3; tm.total = Math.max(tm.total, tm.left); paintTimer(); };
$('#tmReset').onclick = () => { clearInterval(tm.t); tm.on = false; tm.left = tm.total; paintTimer(); };
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
function renderProgreso() {
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
  $('#monthLbl').textContent = MONTHS[mo][0].toUpperCase() + MONTHS[mo].slice(1) + ' ' + y;
  const sDays = new Set(sessions().map((s) => dateKey(s.date)).filter((k) => k.startsWith(y + '-' + String(mo + 1).padStart(2, '0'))));
  const rDays = new Set(S().runs.map((r) => dateKey(r.date)));
  const first = new Date(y, mo, 1), offset = (first.getDay() + 6) % 7, dim = new Date(y, mo + 1, 0).getDate();
  let c = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="wd">${d}</span>`).join('');
  for (let i = 0; i < offset; i++) c += '<span></span>';
  let runsMonth = 0;
  for (let d = 1; d <= dim; d++) {
    const k = dateKey(new Date(y, mo, d)), isRun = rDays.has(k);
    if (isRun) runsMonth++;
    const cls = sDays.has(k) ? 's' : isRun ? 'r' : d === now.getDate() ? 't' : d > now.getDate() ? 'f' : '';
    c += `<span class="d ${cls}">${d}</span>`;
  }
  $('#cal').innerHTML = c;
  $('#monthBig').textContent = sDays.size + (sDays.size === 1 ? ' día' : ' días');
  $('#monthSub').textContent = 'con fuerza · ' + runsMonth + (runsMonth === 1 ? ' carrera' : ' carreras') + ' · meta 3 por semana';
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
  const since = weekStart(), count = {};
  sessions().forEach((s) => { if (new Date(s.date) >= since) s.sets.forEach((x) => (EXERCISES[x.ex]?.m || []).forEach((m) => (count[m] = (count[m] || 0) + 1))); });
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
  const cur = S().current, day = cur ? cur.day : S().nextDay;
  lines.push(`Próximo entrenamiento: ${PROGRAM[day].n} (${PROGRAM[day].t}): ` + PROGRAM[day].slots.map((s, i) => { const o = cur ? s.opts[cur.sel[i]] : s.opts[0]; const pl = planOf(o); return `${EXERCISES[o.id].n} ${o.sets}×${o.reps} a ${kgLabel(EXERCISES[o.id], pl.kg)}`; }).join('; ') + '.');
  const last = sessions().slice(-5);
  if (last.length) {
    lines.push('Últimos entrenamientos:');
    last.forEach((s) => {
      const by = {}; s.sets.forEach((x) => { (by[x.ex] = by[x.ex] || []).push(`${x.kg}×${x.reps}@${x.rir}`); });
      lines.push(`- ${shortDate(s.date)} ${PROGRAM[s.day].n}: ` + Object.entries(by).map(([ex, arr]) => `${EXERCISES[ex].n} ${arr.join(' ')}`).join('; ') + (s.survey ? ` (fatiga ${s.survey.fat}, articulaciones ${s.survey.joint}, rendimiento ${s.survey.perf})` : ''));
    });
  } else lines.push('Todavía no registró entrenamientos en la app.');
  lines.push('1RM estimados: ' + MAIN_LIFTS.map((l) => `${l.n} ${currentORM(l.id) ? fmt(currentORM(l.id)) + ' kg' : 'sin dato'}`).join(', ') + '.');
  lines.push(`Entrenos esta semana: ${weekCount()}/3. Semanas seguidas cumpliendo: ${streak()}.`);
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

/* ---------- AJUSTES ---------- */
function renderAjustes() {
  const p = S().profile, st = S().settings;
  $('#apiKey').value = st.apiKey; $('#apiKey').type = 'password'; $('#keyShow').textContent = 'Mostrar';
  $('#keyStatus').textContent = st.apiKey ? 'Clave cargada.' : 'Sin clave: el coach no funciona y las comidas se calculan con la tabla.';
  $('#modelSel').innerHTML = Object.entries(AI.MODELS).map(([id, m]) => `<option value="${id}" ${id === st.model ? 'selected' : ''}>${m.label} · ${m.note}</option>`).join('');
  $('#sexSel').value = p.sex; $('#nextSel').value = S().nextDay; $('#voiceChk').checked = !!st.voice;
  $('#gKcal').value = p.goals.kcal; $('#gProt').value = p.goals.p; $('#gCarb').value = p.goals.c; $('#gFat').value = p.goals.g;
  $('#ormFields').innerHTML = MAIN_LIFTS.map((l) => `<label class="field"><span>${l.n}</span><input data-orm="${l.id}" type="number" inputmode="decimal" step="2.5" value="${p.orm[l.id] || ''}"></label>`).join('');
  const kb = new Blob([localStorage.getItem('carga:v1') || '']).size;
  $('#storeInfo').textContent = `${sessions().length} entrenamientos, ${S().runs.length} carreras, ${S().meals.length} comidas guardadas (${fmt(kb / 1024, 0)} KB).` + (canPersist() ? '' : ' Atención: no se pudo guardar el último cambio.');
  $('#versionLbl').textContent = 'Carga ' + VERSION;
}
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
    st.profile.sex = $('#sexSel').value; st.profile.goals = g; st.nextDay = $('#nextSel').value; st.settings.voice = $('#voiceChk').checked;
    $$('[data-orm]').forEach((i) => { const v = num(i.value); if (v > 0) st.profile.orm[i.dataset.orm] = v; else delete st.profile.orm[i.dataset.orm]; });
    if (st.current && !st.current.started && st.current.day !== st.nextDay) st.current = null;
  });
  toast('Cambios guardados');
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
  try { importJSON(await f.text()); toast('Copia cargada'); bwDraft = null; renderAjustes(); }
  catch (e) { toast(e.message || 'No se pudo leer el archivo'); }
  $('#impFile').value = '';
};
$('#resetBtn').onclick = () => { $('#resetConfirm').hidden = false; };
$('#resetNo').onclick = () => { $('#resetConfirm').hidden = true; };
$('#resetYes').onclick = () => { resetAll(); $('#resetConfirm').hidden = true; bwDraft = null; showOnboarding(); };

/* ---------- botón + ---------- */
function sheet(open) { $('#sheet').hidden = !open; $('#sheetBg').hidden = !open; $('#fab').setAttribute('aria-expanded', open); $('#fab').classList.toggle('open', open); }
$('#fab').onclick = () => sheet($('#sheet').hidden);
$('#sheetBg').onclick = () => { sheet(false); openSurvey(false); };
$('#sheetX').onclick = () => sheet(false);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { sheet(false); openSurvey(false); } });
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
  $('#obOrm').innerHTML = MAIN_LIFTS.map((l) => `<label class="field"><span>${l.n}</span><input data-oborm="${l.id}" type="number" inputmode="decimal" step="2.5" placeholder="kg"></label>`).join('');
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
  });
  requestPersistence();
  $('#onboard').hidden = true; bwDraft = null;
  go('hoy');
  toast('Listo. Cargá tu clave de API en Ajustes para usar la IA');
};

/* ---------- arranque ---------- */
const RENDER = { hoy: renderHoy, entrenar: renderEntrenar, correr: renderCorrer, progreso: renderProgreso, nutricion: renderNutricion, coach: renderCoach, ajustes: renderAjustes };
if (!S().profile) showOnboarding();
else go(location.hash.slice(1) || 'hoy');
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
