// Tripfolio · app principal (sin dependencias de compilación).
import * as M from './model.js';
import * as DB from './db.js';
import { DayMap, TripMap, dayColor, prefetchTrip, tilesForTrip } from './map.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10l6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
  fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6.5 8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  itin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 5h11M9 12h11M9 19h11"/><circle cx="4.5" cy="5" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="19" r="1.3"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 6.5l5-2 7 2.5 5-2v13l-5 2-7-2.5-5 2z"/><path d="M8.5 4.5v13M15.5 7v13"/></svg>',
  docs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h6"/></svg>',
  lists: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
  suitcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7v12.5M16 7v12.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
};
// Iconos genéricos por tipo de enlace (sin logotipos de marca).
const LINK_ICON = {
  gmaps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  pinterest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="9" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="5.5" rx="1.6"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.6"/><rect x="13.5" y="12" width="7" height="8.5" rx="1.6"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M10.5 9.2v5.6l4.6-2.8z" fill="currentColor"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor"/></svg>',
  web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.5 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.5-3.6-8.5s1.1-5.9 3.6-8.5z"/></svg>',
};
const KIND = { identidad: 'ID', transporte: 'TRN', entrada: 'ENT', alojamiento: 'HTL', tramite: 'TRM', carpeta: 'DIR', otro: 'DOC' };

/* ---------------- Estado ---------------- */
const S = {
  trip: null, base: null, trips: [], view: 'home', day: 0, sel: null, edit: false, full: false, drawer: false,
  tripSel: null, linkFilter: 'all',
  preview: { day: null, min: null }, sheet: null, docFilter: 'day', listTab: 'day', openCl: null,
  online: navigator.onLine, error: null,
};
let map = null, mapEl = null, saveTimer = null, tmap = null, tmapEl = null;

async function boot() {
  try {
    S.trips = (await DB.kvGet('trips')) || [];
    const active = await DB.kvGet('active');
    if (active) await loadTrip(active);
    DB.requestPersist();
  } catch (e) { S.error = e.message; }
  const r = S.trip ? M.currentDayIndex(S.trip) : -1;
  // Durante el viaje se abre directamente en «Hoy»; fuera de él, en la pantalla de inicio.
  if (r > -1) { S.day = r; S.view = 'today'; }
  tick(); setInterval(tick, 15000);
  render();
  hideSplash();
  registerSW();
}

// Retira la pantalla de inicio cuando termina su animación (o enseguida con «reducir movimiento»).
function hideSplash() {
  const el = document.getElementById('splash'); if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = Math.max(0, (reduce ? 350 : 2100) - performance.now());
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, wait);
}

async function loadTrip(id) {
  S.trip = await DB.kvGet('trip:' + id);
  S.base = await DB.kvGet('base:' + id);
  if (!S.trip) return;
  S.day = Math.max(0, M.currentDayIndex(S.trip));
  S.sel = null;
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await DB.kvSet('trip:' + S.trip.trip.id, S.trip); }
    catch (e) { toast('No se pudo guardar en el móvil: ' + e.message, 4000); }
  }, 150);
}

/* ---------------- Utilidades de vista ---------------- */
const day = () => S.trip.days[S.day];
const findItem = id => { for (const d of S.trip.days) { const i = d.items.findIndex(x => x.id === id); if (i > -1) return { day: d, item: d.items[i], idx: i }; } return null; };
const fmtDate = (iso, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-ES', { ...o, timeZone: 'UTC' });
const tzName = tz => ({ 'Asia/Tokyo': 'Japón', 'Europe/Madrid': 'Madrid', 'Europe/Berlin': 'Frankfurt' }[tz] || tz.split('/').pop().replace('_', ' '));
const resChip = r => { const [t, c] = M.RES[r.status] || ['', '']; return t ? `<span class="chip ${c}">${t}</span>` : ''; };
const critChip = it => it.planning === 'critical' && !it.done ? '<span class="chip crit"><span class="dot"></span>Crítico</span>' : '';
const localChip = it => it.local?.fields?.length || it.userAdded ? '<span class="chip local">Cambiado en el móvil</span>' : '';
function toast(msg, ms = 2000) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), ms); }

function tick() {
  const el = $('#clock'); if (!el) return;
  const tz = S.trip?.trip.tz || 'Asia/Tokyo', home = S.trip?.trip.homeTz || 'Europe/Madrid';
  const a = M.nowIn(tz), b = M.nowIn(home);
  el.innerHTML = `<b>${M.fmtMin(a.min)}</b> ${esc(tzName(tz))}<br>${M.fmtMin(b.min)} ${esc(tzName(home))}${S.online ? '' : '<br><span class="offline">SIN CONEXIÓN</span>'}`;
  updateNowPanel();
}

/* ---------------- Render ---------------- */
const TRIP_VIEWS = ['today', 'day', 'map', 'docs', 'lists', 'links', 'settings'];
const VIEW_TITLE = { home: 'Inicio', trips: 'Mis viajes', add: 'Añadir un viaje', today: 'Hoy', day: 'Itinerario', map: 'Mapa del viaje', docs: 'Documentos', lists: 'Checklists', links: 'Enlaces', settings: 'Ajustes y copias' };
let lastView = null;
function render() {
  if (TRIP_VIEWS.includes(S.view) && !S.trip) S.view = 'home';
  const inTrip = TRIP_VIEWS.includes(S.view);
  document.querySelectorAll('nav.bottom button').forEach(b => b.setAttribute('aria-current', b.dataset.view === S.view ? 'page' : 'false'));
  $('nav.bottom').hidden = !inTrip;
  document.body.dataset.view = S.view;
  if (inTrip) {
    $('#tripName').textContent = S.trip.trip.name;
    $('#tripSub').textContent = `${VIEW_TITLE[S.view]} · ${fmtDate(S.trip.trip.startDate, { day: 'numeric', month: 'short' })} – ${fmtDate(S.trip.trip.endDate, { day: 'numeric', month: 'short' })}`;
  } else { $('#tripName').textContent = S.view === 'home' ? 'Tripfolio' : VIEW_TITLE[S.view]; $('#tripSub').textContent = S.view === 'home' ? 'Tus viajes, siempre a mano' : 'Tripfolio'; }
  const m = $('#main');
  if (map && mapEl && mapEl.parentNode) mapEl.parentNode.removeChild(mapEl);
  if (tmap && tmapEl && tmapEl.parentNode) tmapEl.parentNode.removeChild(tmapEl);
  const html = { home: viewHome, trips: viewTrips, add: viewAdd, settings: viewSettings, today: viewToday, day: viewDay, map: viewTripMap, docs: viewDocs, lists: viewLists, links: viewLinks }[S.view]();
  m.innerHTML = `<div class="view${lastView !== S.view ? ' enter' : ''}">${html}</div>`;
  m.classList.toggle('flush', S.view === 'map');
  lastView = S.view;
  renderFullMap();
  if (S.trip && S.view === 'day' && !S.full) mountMap();
  if (S.trip && S.view === 'map') mountTripMap();
  renderDrawer();
  renderLayer();
  if (S.view === 'settings') showStorage();
  tick();
  if (S.view === 'day') { const p = document.querySelector('.daypill[aria-current="true"]'); if (p) p.scrollIntoView({ inline: 'center', block: 'nearest' }); }
}

/* ----- Hoy ----- */
function viewToday() {
  const real = M.currentDayIndex(S.trip);
  const startMs = Date.parse(S.trip.trip.startDate + 'T00:00:00'), endMs = Date.parse(S.trip.trip.endDate + 'T23:59:59');
  const idx = real > -1 ? real : (S.preview.day ?? 0);
  const d = S.trip.days[idx];
  const timed = d.items.some(i => M.toMin(i.start) != null);
  const firstTimed = d.items.find(i => M.toMin(i.start) != null);
  const nowMin = real > -1 ? M.nowIn(d.tz).min : (S.preview.min ?? (firstTimed ? M.toMin(firstTimed.start) : null));
  const st = M.dayStatus(d, nowMin);
  const doneN = d.items.filter(i => i.done).length;
  const crit = d.items.filter(it => it.planning === 'critical' && !it.done);
  const lod = d.lodging || {};
  const docs = (S.trip.documents || []).filter(x => x.day === d.id);
  const dPend = docs.filter(x => x.status === 'pending' && !x.files?.length).length;
  const dl = (S.trip.checklists || []).filter(c => c.day === d.id && c.kind === 'dia');
  let ca = 0, cb = 0; dl.forEach(c => c.sections.forEach(s => s.items.forEach(i => { cb++; if (i.done) ca++; })));
  const daysLeft = Math.ceil((startMs - Date.now()) / 864e5);
  const status = real > -1 ? '' : Date.now() < startMs ? 'Antes del viaje: elige un día y una hora para ver cómo funcionará esta pantalla durante el viaje.' : Date.now() > endMs ? 'El viaje ha terminado. Elige un día para revisarlo.' : 'Hoy no hay un día del viaje que coincida con la fecha.';
  const card = (it, label) => `<div class="now-card">
    <div class="label"><span class="eyebrow" style="color:var(--accent)">${label}</span>${it.start ? `<span class="bigtime">${esc(it.start)}${it.end ? ' – ' + esc(it.end) : ''}</span>` : '<span class="muted small">Sin hora</span>'}</div>
    <h3>${esc(it.title)}</h3>
    <div class="row"><span class="typemark ${it.type}"><i></i>${M.TYPES[it.type]}${it.mode ? ' · ' + M.MODES[it.mode] : ''}</span>${it.reservation ? resChip(it.reservation) : ''}${critChip(it)}</div>
    ${it.note ? `<div class="muted small">${esc(it.note)}</div>` : ''}${it.userNote ? `<div class="small">📝 ${esc(it.userNote)}</div>` : ''}`;
  const howBtn = st.next && M.hasGeo(st.next)
    ? `<a class="btn primary" href="${esc(st.from && st.from !== st.next ? M.mapsDirUrl(st.from.location, st.next.location, st.leg ? st.leg.mode : 'walk') : M.mapsSearchUrl(st.next.location))}" target="_blank" rel="noopener">${st.from && st.from !== st.next ? 'Cómo llegar' : 'Ver en Google Maps'}</a>` : '';
  return `<div class="today gut">
   ${nowPanel(real, startMs, endMs)}
   <div class="hero-day">
     <div class="eyebrow">${real > -1 ? 'Hoy' : 'Vista previa'} · Día ${d.n} de ${S.trip.days.length} · ${esc(d.city)}</div>
     <h1>${esc(d.title)}</h1>
     <div class="status-line">${esc(fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${doneN} de ${d.items.length} hechos</div>
     <div class="prog" aria-hidden="true"><i style="width:${d.items.length ? doneN / d.items.length * 100 : 0}%"></i></div>
   </div>
   ${real === -1 ? `<div class="panel"><div class="status-line">${status}</div>
     <div class="sim"><label class="field" for="pvDay">Día<select id="pvDay">${S.trip.days.map((x, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>Día ${x.n} · ${fmtDate(x.date)}</option>`).join('')}</select></label>
     <label class="field" for="pvTime">Hora (${esc(tzName(d.tz))})<input type="time" id="pvTime" value="${nowMin != null ? M.fmtMin(nowMin) : ''}" ${timed ? '' : 'disabled'}></label></div>
     ${timed ? '' : '<div class="muted small">Este día no tiene horas: se sigue el orden de la lista.</div>'}</div>` : ''}
   ${d.note ? `<div class="daynote">${esc(d.note)}</div>` : ''}
   ${st.cur ? card(st.cur, 'Ahora') + `<div class="row"><button class="btn" data-done="${st.cur.id}">Marcar como hecho</button><button class="btn ghost" data-open="${st.cur.id}">Detalle</button></div></div>` : ''}
   ${st.next ? card(st.next, st.cur ? 'Después' : 'Siguiente') + `
     ${st.leg ? `<div class="how"><span style="flex:1;min-width:0">${st.leg.title.toLowerCase().startsWith((M.MODES[st.leg.mode] || '').toLowerCase()) && st.leg.mode ? `<b>${esc(st.leg.title)}</b>` : `<b>${M.MODES[st.leg.mode] || 'Traslado'}</b> · ${esc(st.leg.title)}`}${M.duration(st.leg, d.tz) ? ' · ' + M.duration(st.leg, d.tz) : ''}</span></div>` : ''}
     <div class="row">${howBtn}<button class="btn ghost" data-open="${st.next.id}">Detalle</button>${st.cur ? '' : `<button class="btn ghost" data-done="${st.next.id}">Hecho</button>`}</div></div>`
     : `<div class="panel"><div class="muted">No queda nada pendiente este día.</div></div>`}
   ${st.later.length ? `<div class="panel"><div class="eyebrow">Más tarde</div><div class="later">${st.later.map(i => `<button data-open="${i.id}"><span class="t">${esc(i.start || '—')}</span><span class="x">${esc(i.title)}</span>${i.planning === 'critical' ? '<span class="chip crit"><span class="dot"></span></span>' : '<span></span>'}</button>`).join('')}</div></div>` : ''}
   <div class="mini-grid">
     <button class="mini" data-goview="docs"><span class="eyebrow">Documentos</span><span class="v">${docs.length}</span><span class="s">${docs.length ? (dPend ? dPend + ' pendiente' + (dPend > 1 ? 's' : '') : 'Todos listos') : 'Ninguno este día'}</span></button>
     <button class="mini" data-goview="lists"><span class="eyebrow">Checklist</span><span class="v">${cb ? ca + '/' + cb : '—'}</span><span class="s">${cb ? (ca === cb ? 'Completo' : 'Del día') : 'Sin checklist'}</span></button>
   </div>
   <div class="panel">
     <div class="eyebrow">Alojamiento esta noche</div>
     <h3>${esc(lod.name || 'Sin alojamiento')}</h3>
     ${lod.address ? `<div class="muted small">${esc(lod.address)}</div>` : ''}
     ${lod.checkin ? `<div class="small">Check-in <span class="mono">${esc(lod.checkin)}</span></div>` : ''}
     ${lod.lat != null || (lod.address && lod.address !== 'Pendiente') ? `<div class="row"><a class="btn ghost" href="${esc(M.mapsSearchUrl(lod))}" target="_blank" rel="noopener">Abrir en Google Maps</a></div>` : ''}
   </div>
   ${crit.length ? `<div class="panel"><div class="eyebrow">Puntos críticos</div><div class="later">${crit.map(c => `<button data-open="${c.id}"><span class="t">${esc(c.start || '—')}</span><span class="x">${esc(c.title)}</span><span class="chip crit"><span class="dot"></span></span></button>`).join('')}</div></div>` : ''}
   <button class="btn primary block" data-goday="${idx}">Ver itinerario y mapa del día ${d.n}</button>
  </div>`;
}

/* Fecha, hora actual y cuenta atrás hasta el inicio del viaje (se actualiza en tick). */
function nowPanel(real, startMs, endMs) {
  const t = S.trip.trip, home = t.homeTz || 'Europe/Madrid', dest = t.tz;
  const st = M.tripStart(S.trip);
  const before = Date.now() < st.at, after = Date.now() > endMs;
  const startTxt = `${fmtDate(st.date, { weekday: 'short', day: 'numeric', month: 'short' })}${st.time ? ', ' + st.time : ''} hora de ${tzName(st.tz)}`;
  return `<div class="nowpanel">
    <div class="np-date" id="npDate"></div>
    <div class="np-clocks"><div><span class="eyebrow">${esc(tzName(home))}</span><b class="mono" id="npHome"></b></div><div><span class="eyebrow">${esc(tzName(dest))}</span><b class="mono" id="npDest"></b><span class="muted small" id="npDestDay"></span></div></div>
    ${before ? `<div class="np-count" aria-live="polite"><div class="cd" id="countdown"></div><div class="muted small">hasta el inicio del viaje · ${esc(startTxt)}${st.item ? ' · ' + esc(st.item.title) : ''}</div></div>`
      : after ? '<div class="np-count"><div class="muted">El viaje ha terminado.</div></div>'
      : real > -1 ? `<div class="np-count"><div class="cd">Día ${S.trip.days[real].n} <span class="muted">de ${S.trip.days.length}</span></div></div>` : ''}
  </div>`;
}
function updateNowPanel() {
  if (!S.trip || !$('#npDate')) return;
  const t = S.trip.trip, home = t.homeTz || 'Europe/Madrid', dest = t.tz, now = new Date();
  const f = (tz, o) => now.toLocaleString('es-ES', { timeZone: tz, ...o });
  $('#npDate').textContent = f(home, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#npHome').textContent = f(home, { hour: '2-digit', minute: '2-digit' });
  $('#npDest').textContent = f(dest, { hour: '2-digit', minute: '2-digit' });
  const dh = M.nowIn(home).date, dd = M.nowIn(dest).date;
  $('#npDestDay').textContent = dh !== dd ? ' · ' + f(dest, { weekday: 'short', day: 'numeric' }) : '';
  const cd = $('#countdown');
  if (cd) {
    const b = M.breakdown(M.tripStart(S.trip).at - Date.now());
    cd.innerHTML = `<b>${b.days}</b> ${b.days === 1 ? 'día' : 'días'} <b>${b.hours}</b> h <b>${b.minutes}</b> min`;
  }
}

/* ----- Itinerario ----- */
function viewDay() {
  const d = day(), order = M.markerOrder(d), warn = M.chronologyWarnings(d), real = M.currentDayIndex(S.trip);
  const strip = S.trip.days.map((x, i) => `<button class="daypill ${x.kind === 'transit' ? 'transit' : ''} ${i === real ? 'today' : ''} ${x.review ? 'rev' : ''}" data-day="${i}" aria-current="${i === S.day}" aria-label="Día ${x.n}, ${fmtDate(x.date, { day: 'numeric', month: 'long' })}${x.review ? ', revisado' : ''}"><span class="n">DÍA ${x.n}</span><span class="d">${new Date(x.date + 'T12:00:00Z').getUTCDate()} ${fmtDate(x.date, { month: 'short' }).replace('.', '')}</span></button>`).join('');
  const lod = d.lodging || {};
  let html = '';
  d.items.forEach((it, i) => {
    const sel = S.sel === it.id;
    if (it.type === 'transport') {
      const cls = it.mode === 'flight' ? 'flight' : M.TRANSIT.includes(it.mode) ? 'transit' : '';
      html += `<div class="seg ${cls} ${sel ? 'sel' : ''} ${it.done ? 'done' : ''}"><div class="when">${esc(it.start || '')}</div>
        <div class="wrapbar"><button class="bar" data-sel="${it.id}">${it.title.toLowerCase().startsWith((M.MODES[it.mode] || '').toLowerCase()) && it.mode ? '' : `<span>${M.MODES[it.mode] || 'Traslado'}</span>`}<b>${esc(it.title)}</b>${M.duration(it, d.tz) ? `<span>· ${M.duration(it, d.tz)}</span>` : ''}${it.reservation ? resChip(it.reservation) : ''}</button>${S.edit ? editCtl(it, i, d) : (sel ? `<button class="more" data-open="${it.id}">Detalle ›</button>` : '')}</div></div>`;
      return;
    }
    const tzNote = it.tz && it.tz !== d.tz ? ` <span style="font-size:10px">${esc(tzName(it.tz))}</span>` : '';
    html += `<div class="item"><div class="when">${it.start ? `<b>${esc(it.start)}</b>${esc(it.end || '')}${tzNote}` : (it.end ? `<span style="font-size:11px">antes de</span><b>${esc(it.end)}</b>` : '<span style="color:var(--faint)">—</span>')}</div>
      <div class="card ${sel ? 'sel' : ''} ${it.done ? 'done' : ''} ${it.optional ? 'optional' : ''}">
        <button class="check" data-done="${it.id}" aria-label="${it.done ? 'Marcar como pendiente' : 'Marcar como hecho'}" aria-pressed="${!!it.done}">${ICON.check}</button>
        <div class="body" data-sel="${it.id}" role="button" tabindex="0">
          <div class="nm">${esc(it.title)}</div>
          <div class="meta">${order[it.id] ? `<span class="num">${order[it.id]}</span>` : ''}<span class="typemark ${it.type}"><i></i>${M.TYPES[it.type]}</span>${M.duration(it, d.tz) ? `<span>· ${M.duration(it, d.tz)}</span>` : ''}${it.reservation ? resChip(it.reservation) : ''}${critChip(it)}${localChip(it)}${!M.hasGeo(it) && ['visit', 'hotel', 'station'].includes(it.type) ? '<span style="color:var(--faint)">Sin ubicación</span>' : ''}</div>
          ${warn[it.id] ? `<div class="warn">${esc(warn[it.id])}</div>` : ''}
          ${it.missingFromSource ? '<div class="warn">Ya no está en la última importación de Notion</div>' : ''}
          ${it.userNote ? `<div class="muted small">📝 ${esc(it.userNote)}</div>` : ''}
        </div>
        <div class="side">${S.edit ? editCtl(it, i, d) : (sel ? `<button class="more" data-open="${it.id}">Detalle ›</button>` : '')}</div>
      </div></div>`;
  });
  return `<div class="gut">
   <div class="daystrip" aria-label="Días del viaje">${strip}</div>
   <div class="dayhead"><div style="min-width:0"><div class="eyebrow">Día ${d.n} · ${esc(fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h2>${esc(d.title)}</h2>${d.review ? `<span class="chip ok rev-chip">${ICON.check}Día revisado</span>` : ''}</div>
     <button class="toggle-edit" id="editBtn" aria-pressed="${S.edit}">${S.edit ? 'Listo' : 'Editar'}</button></div>
   ${lod.name ? `<button class="lodging-strip" ${lod.lat != null ? 'data-lodging' : ''}><span class="ico">H</span><div><div class="nm">${esc(lod.name)}</div><div class="muted" style="font-size:12px">${lod.checkin ? 'Check-in ' + esc(lod.checkin) + ' · ' : ''}Alojamiento de esta noche</div></div></button>` : ''}
   ${d.note ? `<div class="daynote">${esc(d.note)}</div>` : ''}
   ${S.full ? '' : mapWrapHtml(d, order, false)}
   ${dayLinks(d)}
   <div class="timeline">${html}
     ${S.edit ? `<button class="btn ghost block" id="addItem">+ Añadir elemento al día ${d.n}</button>` : ''}
   </div>
   <div class="muted small" style="padding-bottom:24px"><a href="${esc(d.source?.url || '#')}" target="_blank" rel="noopener">Abrir el día ${d.n} en Notion</a></div>
  </div>`;
}
/* Mapa del día: en línea o a pantalla completa (capa propia sobre la barra inferior, que sigue activa). */
function mapWrapHtml(d, order, full) {
  return `<div class="mapwrap ${full ? 'full' : ''}" id="mapwrap">
     <div id="mapSlot"></div>
     ${full ? `<div class="fm-top"><button class="fm-close" id="fullClose">${ICON.back}<span>Volver</span></button><div class="fm-title"><span>Día ${d.n}</span><b>${esc(d.title)}</b></div></div>` : ''}
     <div class="map-legend"><span><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#A3ABB5" stroke-width="2" stroke-dasharray="4 3"/></svg>A pie</span><span><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#7FA8E6" stroke-width="2.4"/></svg>Transporte</span>${full ? '' : '<span>Líneas = orden, no ruta</span>'}</div>
     <div class="map-status" id="mapStatus" hidden></div>
     <div class="map-tools">${full ? '' : `<button class="map-btn" id="fullBtn" aria-label="Mapa a pantalla completa">${ICON.expand}</button>`}<button class="map-btn" id="fitBtn" aria-label="Encuadrar el día">${ICON.fit}</button></div>
     ${full ? `<div class="fm-chips">${d.items.filter(i => order[i.id]).map(i => `<button class="${S.sel === i.id ? 'sel' : ''}" data-sel="${i.id}"><span class="mono">${order[i.id]}</span>${esc(i.title)}</button>`).join('')}</div>` : ''}
   </div>`;
}
function renderFullMap() {
  const fm = $('#fullmap');
  const on = S.full && S.view === 'day' && !!S.trip;
  fm.classList.toggle('on', on);
  if (!on) { if (fm.innerHTML) fm.innerHTML = ''; return; }
  fm.innerHTML = mapWrapHtml(day(), M.markerOrder(day()), true);
  mountMap();
  const c = fm.querySelector('.fm-chips .sel'); if (c) c.scrollIntoView({ inline: 'center', block: 'nearest' });
}
/* Enlaces de referencia asociados a un día (en el itinerario). */
function dayLinks(d) {
  const ls = (S.trip.userLinks || []).filter(l => l.day === d.id);
  if (!ls.length) return '';
  return `<div class="daylinks"><span class="eyebrow">Enlaces del día</span><div class="dl-row">${ls.map(l => `<a class="dl-chip k-${M.linkKind(l.url)}" href="${esc(l.url)}" target="_blank" rel="noopener"><i>${LINK_ICON[M.linkKind(l.url)]}</i>${esc(l.title)}</a>`).join('')}</div></div>`;
}

function editCtl(it, i, d) {
  return `<div class="edit-ctl"><button data-mv="-1" data-id="${it.id}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button data-mv="1" data-id="${it.id}" aria-label="Bajar" ${i === d.items.length - 1 ? 'disabled' : ''}>${ICON.down}</button></div>`;
}

const MAP_MSG = {
  nostyle: 'Sin mapa base: no hay conexión y esta zona no está guardada. Los marcadores siguen funcionando.',
  tiles: 'Parte del mapa no se ha podido cargar (sin conexión o zona no guardada).',
};
let mapStatus = 'ok';
function showMapStatus() { const el = $('#mapStatus'); if (el) { el.hidden = mapStatus === 'ok'; el.textContent = MAP_MSG[mapStatus] || ''; } }
function mountMap() {
  const slot = $('#mapSlot'); if (!slot) return;
  if (!mapEl) {
    mapEl = document.createElement('div'); mapEl.id = 'map';
    slot.replaceWith(mapEl);
    map = new DayMap(mapEl, {
      onSelect: (id, open) => { S.sel = id; if (open) S.sheet = { type: 'detail', id }; render(); },
      onStatus: s => { mapStatus = s; showMapStatus(); },
    });
  } else slot.replaceWith(mapEl);
  showMapStatus();
  const d = day();
  const key = d.id + '|' + S.full;
  map.resize();
  const n = map.render(d, S.sel, { fit: map._last !== key });
  if (map._last !== key) setTimeout(() => map.fitDay(d), 80);
  map._last = key;
  if (S.sel) map.focus(d, S.sel);
  const wrap = $('#mapwrap');
  if (!n && wrap) { const e = document.createElement('div'); e.className = 'map-empty'; e.textContent = 'Ningún elemento de este día tiene ubicación.'; wrap.appendChild(e); }
}

/* ----- Documentos ----- */
function viewDocs() {
  const real = M.currentDayIndex(S.trip), d = S.trip.days[real > -1 ? real : S.day];
  const all = S.trip.documents || [];
  let list = all;
  if (S.docFilter === 'day') list = all.filter(x => x.day === d.id);
  if (S.docFilter === 'pending') list = all.filter(x => x.status === 'pending' && !x.files?.length);
  const groups = new Map();
  list.forEach(x => { const k = x.day ? x.day : 'trip'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
  const pend = all.filter(x => x.status === 'pending' && !x.files?.length).length;
  const label = k => k === 'trip' ? 'Todo el viaje' : (() => { const dd = S.trip.days.find(x => x.id === k); return `Día ${dd.n} · ${fmtDate(dd.date)}`; })();
  const row = x => {
    const has = x.files?.length;
    const cls = has ? 'has' : x.status;
    return `<button class="doc ${cls}" data-doc="${x.id}"><span class="k">${KIND[x.kind] || 'DOC'}</span><div><div class="tt">${esc(x.title)}</div><div class="ds">${has ? `<span style="color:var(--ok)">${has} archivo${has > 1 ? 's' : ''} en el móvil</span> · ` : x.status === 'pending' ? '<span style="color:var(--crit)">Pendiente</span> · ' : ''}${esc(x.detail || '')}</div></div><span class="go">${has ? 'Abrir' : 'Añadir'}</span></button>`;
  };
  return `<div class="docs gut">
   <div class="seg-ctl" role="group" aria-label="Filtrar documentos">
     <button data-docf="day" aria-pressed="${S.docFilter === 'day'}">Día ${d.n}</button><button data-docf="pending" aria-pressed="${S.docFilter === 'pending'}">Pendientes · ${pend}</button><button data-docf="all" aria-pressed="${S.docFilter === 'all'}">Todos</button></div>
   ${groups.size ? [...groups].map(([k, v]) => `<div class="doc-group"><h4>${esc(label(k))}</h4>${v.map(row).join('')}</div>`).join('') : `<div class="panel"><div class="muted">No hay documentos para el día ${d.n}. Cambia de día en Itinerario o mira “Todos”.</div></div>`}
   <button class="btn ghost block" id="addDoc">+ Añadir documento</button>
   <div class="notice">Los archivos que añades (PDF, capturas, QR) se guardan solo en este iPhone y se abren sin conexión. No se suben a ningún sitio. Haz una copia de seguridad con archivos desde Ajustes y copias.</div>
  </div>`;
}

/* ----- Checklists ----- */
function viewLists() {
  const real = M.currentDayIndex(S.trip), d = S.trip.days[real > -1 ? real : S.day], tab = S.listTab;
  const lists = S.trip.checklists || [];
  const cls = tab === 'day' ? lists.filter(c => c.day === d.id && c.kind === 'dia')
    : tab === 'film' ? lists.filter(c => c.day === d.id && c.kind === 'rodaje')
    : lists.filter(c => c.scope === 'trip' && c.kind === (tab === 'bags' ? 'equipaje' : 'viaje'));
  const block = c => {
    let a = 0, b = 0; c.sections.forEach(s => s.items.forEach(i => { b++; if (i.done) a++; }));
    const open = S.openCl === c.id || tab === 'day' || tab === 'film';
    return `<details class="cl" ${open ? 'open' : ''} data-cl="${c.id}"><summary><span class="ttl">${esc(c.title)}</span><span class="cnt ${a === b ? 'full' : ''}">${a}/${b}</span></summary>
     ${c.sections.map(sec => `${sec.title ? `<div class="sub">${esc(sec.title)}</div>` : ''}<ul>${sec.items.map(i => `<li><button data-ck="${i.id}" aria-pressed="${!!i.done}"><span class="bx">${ICON.check}</span><span>${esc(i.text)}</span></button></li>`).join('')}</ul>`).join('')}</details>`;
  };
  return `<div class="lists gut">
   <div class="seg-ctl" role="group" aria-label="Tipo de checklist">
     <button data-lt="day" aria-pressed="${tab === 'day'}">Día ${d.n}</button><button data-lt="film" aria-pressed="${tab === 'film'}">Rodaje</button><button data-lt="bags" aria-pressed="${tab === 'bags'}">Equipaje</button><button data-lt="trip" aria-pressed="${tab === 'trip'}">Viaje</button></div>
   ${cls.length ? cls.map(block).join('') : `<div class="panel"><div class="muted">El día ${d.n} no tiene ${tab === 'film' ? 'lista de rodaje' : 'checklist'}.</div></div>`}
   ${tab === 'day' || tab === 'film' ? '<div class="muted small">Se muestra el día de hoy durante el viaje; fuera de él, el día elegido en Itinerario.</div>' : ''}
  </div>`;
}

/* ----- Inicio ----- */
const pageHead = (title, sub) => `<div class="page-head"><h1>${esc(title)}</h1>${sub ? `<div class="muted">${sub}</div>` : ''}</div>`;
function tripState(t) {
  const now = Date.now(), st = Date.parse(t.startDate + 'T00:00:00'), en = Date.parse(t.endDate + 'T23:59:59');
  if (now < st) { const d = Math.ceil((st - now) / 864e5); return { k: 'soon', label: 'Próximo', big: d === 1 ? 'Mañana' : `Faltan ${d} días` }; }
  if (now <= en) { const d = Math.floor((now - st) / 864e5) + 1, tot = Math.round((en - st) / 864e5); return { k: 'now', label: 'En curso', big: `Día ${d} de ${tot}` }; }
  return { k: 'past', label: 'Terminado', big: 'Viaje terminado' };
}
const range = t => `${fmtDate(t.startDate, { day: 'numeric', month: 'short' })} – ${fmtDate(t.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
function viewHome() {
  const h = new Date().getHours();
  const hi = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const t = S.trip?.trip;
  const stt = t ? tripState(t) : null;
  const hero = t ? `<button class="hero-trip ${stt.k}" data-go="today">
      <span class="ht-glow" aria-hidden="true"></span>
      <span class="eyebrow">${stt.k === 'now' ? 'Viaje en curso' : stt.k === 'soon' ? 'Tu próximo viaje' : 'Último viaje'}</span>
      <span class="ht-name">${esc(t.name)}</span>
      <span class="ht-dates">${range(t)} · ${S.trip.days.length} días</span>
      <span class="ht-big">${esc(stt.big)}</span>
      <span class="ht-cta">Continuar ${ICON.chev}</span></button>`
    : `<button class="hero-trip empty" data-go="add"><span class="ht-glow" aria-hidden="true"></span><span class="eyebrow">Empieza aquí</span><span class="ht-name">Tu primer viaje</span><span class="ht-dates">Importa el itinerario y tenlo siempre a mano, también sin conexión.</span><span class="ht-cta">Añadir un viaje ${ICON.chev}</span></button>`;
  return `<div class="home gut">
    <div class="home-brand"><img src="icons/logo.svg" alt="" width="52" height="52"><div><div class="hb-name">Trip<b>folio</b></div><div class="muted small">${hi} · ${esc(new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</div></div></div>
    ${hero}
    <div class="home-grid">
      <button class="tile" data-go="add"><span class="ti-ico">${ICON.plus}</span><b>Añadir un viaje</b><span>Desde Notion o una copia</span></button>
      <button class="tile" data-go="trips"><span class="ti-ico">${ICON.suitcase}</span><b>Mis viajes</b><span>${S.trips.length ? S.trips.length + (S.trips.length === 1 ? ' viaje' : ' viajes') : 'Aún ninguno'}</span></button>
    </div>
    ${t ? `<div class="quick"><span class="eyebrow">Accesos rápidos</span>
      <div class="q-row">
        <button data-go="map"><i>${ICON.map}</i>Mapa del viaje</button>
        <button data-go="lists"><i>${ICON.lists}</i>Checklists</button>
        <button data-go="links"><i>${ICON.link}</i>Enlaces</button>
        <button data-go="settings"><i>${ICON.gear}</i>Ajustes</button>
      </div></div>` : ''}
  </div>`;
}

/* ----- Mis viajes ----- */
function viewTrips() {
  const act = S.trip?.trip.id;
  return `<div class="trips gut">
   ${pageHead('Mis viajes', S.trips.length ? `${S.trips.length} ${S.trips.length === 1 ? 'viaje guardado' : 'viajes guardados'} en este iPhone` : '')}
   ${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}
   ${S.trips.length ? S.trips.map(x => { const st = tripState(x); return `<button class="tcard ${x.id === act ? 'active' : ''}" data-trip="${x.id}">
      <span class="tc-band" aria-hidden="true"></span>
      <span class="tc-body"><span class="row" style="gap:6px"><span class="chip ${st.k === 'now' ? 'acc' : ''}">${st.label}</span>${x.id === act ? '<span class="chip ok">Abierto</span>' : ''}</span>
      <span class="tc-name">${esc(x.name)}</span><span class="muted small">${range(x)}</span><span class="tc-big">${esc(st.big)}</span></span>
      <span class="tc-go">${ICON.chev}</span></button>`; }).join('')
     : `<div class="empty-state"><span class="es-ico">${ICON.suitcase}</span><b>Aún no hay viajes</b><span class="muted small">Añade el primero importando el archivo del viaje.</span></div>`}
   <button class="btn primary block" data-go="add">${ICON.plus} Añadir un viaje</button>
  </div>`;
}

/* ----- Añadir un viaje ----- */
function viewAdd() {
  return `<div class="add gut">
   ${pageHead('Añadir un viaje', 'Elige cómo quieres traerlo. Todo se guarda solo en este iPhone y funciona sin conexión.')}
   <div class="opt-card">
     <span class="oc-ico">${ICON.docs}</span>
     <div><b>Importar desde Notion</b><div class="muted small">Archivo JSON generado a partir del itinerario. Si el viaje ya existe, se actualiza conservando lo que hayas marcado, tus notas y tus enlaces.</div></div>
   </div>
   <div class="opt-card">
     <span class="oc-ico">${ICON.suitcase}</span>
     <div><b>Restaurar una copia de seguridad</b><div class="muted small">El archivo <span class="mono">copia-….json</span> que exportaste desde Ajustes. Recupera el viaje tal como lo guardaste.</div></div>
   </div>
   <label class="btn primary block" for="importFile">Elegir archivo JSON</label>
   <input type="file" id="importFile" accept="application/json,.json" hidden>
   <div id="importMsg"></div>
   <div class="opt-card soon"><span class="oc-ico">${ICON.plus}</span><div><b>Crear desde plantilla</b><div class="muted small">Próximamente: plantilla de Notion para preparar nuevos viajes.</div></div></div>
  </div>`;
}

/* ----- Ajustes y copias del viaje abierto ----- */
function viewSettings() {
  const t = S.trip;
  const conf = t?.conflicts || [];
  return `<div class="trips gut">
   ${pageHead('Ajustes y copias', esc(t.trip.name))}
   ${conf.length ? `<div class="panel"><div class="eyebrow">Conflictos de la última importación · ${conf.length}</div><div class="muted small">Cambiaste estos datos en el móvil y Notion también los cambió. Ahora se muestra tu versión.</div>
     ${conf.map((x, i) => `<div class="conf"><div><b>${esc(x.title)}</b> · ${esc(x.field)}</div><div class="small">Tuyo: <span class="mono">${esc(x.local ?? '—')}</span> · Notion: <span class="mono">${esc(x.incoming ?? '—')}</span></div><div class="row"><button class="btn" data-conf="${i}" data-keep="local">Mantener el mío</button><button class="btn ghost" data-conf="${i}" data-keep="incoming">Usar el de Notion</button></div></div>`).join('')}</div>` : ''}
   <div class="panel">
     <div class="eyebrow">Actualizar desde Notion</div>
     <div class="muted small">Importa el JSON actualizado: se fusiona con tus cambios (marcas, notas, enlaces y lo que hayas añadido) y te avisa de los conflictos.</div>
     <button class="btn block" data-go="add">Importar archivo</button>
   </div>
   <div class="panel">
     <div class="eyebrow">Copia de seguridad</div>
     <div class="muted small">Guarda tus marcas, notas, enlaces y cambios. Hazla antes de borrar datos o cambiar de móvil.</div>
     <div class="row"><button class="btn" id="backupBtn">Exportar copia</button><button class="btn ghost" id="backupFilesBtn">Con archivos de documentos</button></div>
     <div id="backupMsg" class="muted small"></div>
   </div>
   <div class="panel">
     <div class="eyebrow">Mapas sin conexión</div>
     <div class="muted small">Descarga el mapa de las zonas del viaje para verlo sin internet (aprox. ${mapEstimate()}). Hazlo con wifi antes de salir. Las zonas que veas con conexión también se guardan solas.</div>
     <div id="mapsDl"><button class="btn primary block" id="offlineMaps">Descargar mapas del viaje</button></div>
   </div>
   <div class="panel">
     <div class="eyebrow">Este iPhone</div>
     <div id="storageInfo" class="muted small">Calculando espacio…</div>
     <div id="dangerArea"><button class="btn danger ghost" id="deleteTrip">Borrar este viaje del móvil</button></div>
   </div>
   <div class="panel">
     <div class="eyebrow">Límites</div>
     <ul class="limits">
       <li>Las posiciones del mapa son aproximadas y las líneas indican el orden, no la ruta. Las rutas reales las calcula Google Maps al abrirlo.</li>
       <li>Sin conexión, la agenda, documentos y checklists funcionan; el mapa base solo muestra zonas ya vistas, y Google Maps y los enlaces necesitan internet.</li>
       <li>Los cambios se guardan solo en este iPhone y no vuelven a Notion.</li>
       <li>Si iOS borra los datos de la web, se recuperan con la copia de seguridad.</li>
     </ul>
   </div>
  </div>`;
}

/* ----- Mapa del viaje ----- */
function viewTripMap() {
  const sel = S.tripSel, days = S.trip.days;
  const chips = `<button data-tday="all" class="${sel == null ? 'sel' : ''}">Todo el viaje</button>` + days.map((d, i) => `<button data-tday="${i}" class="${sel === i ? 'sel' : ''}" style="--c:${dayColor(i)}"><i></i>Día ${d.n}</button>`).join('');
  let card = '';
  if (sel != null) {
    const d = days[sel], s = M.daySummary(d), lod = d.lodging || {};
    const modes = s.modes.map(m => M.MODES[m]).filter(Boolean).join(', ');
    card = `<div class="tm-card" style="--c:${dayColor(sel)}">
      <div class="tm-h"><span class="tm-dot"></span><div style="min-width:0;flex:1"><div class="eyebrow">Día ${d.n} · ${esc(fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(d.city)}${d.review ? ' · ✓ Revisado' : ''}</div><h3>${esc(d.title)}</h3></div><button class="close" data-tday="all" aria-label="Cerrar resumen">${ICON.x}</button></div>
      <div class="tm-stats"><div><b>${s.stops}</b><span>paradas</span></div><div><b>${s.km ? (s.km < 10 ? s.km.toLocaleString('es-ES') : Math.round(s.km)) : '—'}</b><span>km en línea recta</span></div><div><b>${s.from ? esc(s.from) : '—'}</b><span>${s.to ? 'a ' + esc(s.to) : 'inicio'}</span></div></div>
      ${s.first && s.last && s.first !== s.last ? `<div class="tm-route"><span>${esc(s.first)}</span>${ICON.chev}<span>${esc(s.last)}</span></div>` : ''}
      <div class="muted small">${s.legs ? `${s.legs} traslado${s.legs > 1 ? 's' : ''}${modes ? ' · ' + esc(modes) : ''}` : 'Sin traslados'}${lod.name ? ' · Noche en ' + esc(lod.name) : ''}${s.done ? ` · ${s.done}/${s.total} hechos` : ''}</div>
      ${s.highlights.length ? `<div class="tm-hl">${s.highlights.map(h => `<span class="chip">${esc(h)}</span>`).join('')}</div>` : ''}
      <div class="row"><button class="btn primary" data-goday="${sel}" style="flex:1">Ver el día ${d.n}</button><button class="btn ghost" data-tstep="-1" aria-label="Día anterior" ${sel === 0 ? 'disabled' : ''}>${ICON.back}</button><button class="btn ghost" data-tstep="1" aria-label="Día siguiente" ${sel === days.length - 1 ? 'disabled' : ''}>${ICON.chev}</button></div>
    </div>`;
  } else card = '<div class="tm-hint">Toca una ruta o un número para ver el resumen del día</div>';
  return `<div class="tripmap">
    <div class="tm-chips" role="group" aria-label="Elegir día">${chips}</div>
    <div class="tm-map"><div id="tmapSlot"></div><div class="map-status" id="tmapStatus" hidden></div>
      <div class="map-tools"><button class="map-btn" id="tmFit" aria-label="Encuadrar">${ICON.fit}</button></div></div>
    ${card}
  </div>`;
}
function mountTripMap() {
  const slot = $('#tmapSlot'); if (!slot) return;
  const first = !tmapEl;
  if (first) {
    tmapEl = document.createElement('div'); tmapEl.id = 'tmap';
    slot.replaceWith(tmapEl);
    tmap = new TripMap(tmapEl, {
      onSelect: i => { if (S.tripSel === i) return; S.tripSel = i; render(); },
      onStatus: s => { const el = $('#tmapStatus'); if (el) { el.hidden = s === 'ok'; el.textContent = MAP_MSG[s] || ''; } },
    });
  } else slot.replaceWith(tmapEl);
  tmap.resize();
  const key = S.trip.trip.id + '|' + S.tripSel;
  tmap.render(S.trip, S.tripSel, { fit: false });
  if (tmap._key !== key) {
    const pad = S.tripSel != null ? { top: 60, bottom: Math.min(330, (tmapEl.clientHeight || 500) * 0.55), left: 40, right: 40 } : null;
    setTimeout(() => (S.tripSel != null ? tmap.fitDay(S.tripSel, pad) : tmap.fitAll()), first ? 120 : 30);
  }
  tmap._key = key;
  const c = document.querySelector('.tm-chips .sel'); if (c) c.scrollIntoView({ inline: 'center', block: 'nearest' });
}

/* ----- Enlaces de referencia ----- */
function viewLinks() {
  const all = S.trip.userLinks || [];
  const counts = {}; all.forEach(l => { const k = M.linkKind(l.url); counts[k] = (counts[k] || 0) + 1; });
  if (S.linkFilter !== 'all' && !counts[S.linkFilter]) S.linkFilter = 'all';
  const list = S.linkFilter === 'all' ? all : all.filter(l => M.linkKind(l.url) === S.linkFilter);
  const dayOf = id => S.trip.days.find(d => d.id === id);
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const card = l => { const k = M.linkKind(l.url), d = l.day ? dayOf(l.day) : null; return `<div class="lk k-${k}">
      <a class="lk-main" href="${esc(l.url)}" target="_blank" rel="noopener"><i class="lk-ico">${LINK_ICON[k]}</i>
        <span class="lk-txt"><span class="tt">${esc(l.title)}</span><span class="ds">${M.LINK_KINDS[k]} · ${esc(host(l.url))}${d ? ` · Día ${d.n}` : ''}</span>${l.note ? `<span class="nt">${esc(l.note)}</span>` : ''}</span>
        <span class="lk-ext">${ICON.ext}</span></a>
      <button class="lk-more" data-linkedit="${l.id}" aria-label="Editar enlace">${ICON.more}</button></div>`; };
  return `<div class="links gut">
   ${pageHead('Enlaces', all.length ? `${all.length} ${all.length === 1 ? 'enlace' : 'enlaces'} de referencia` : 'Ideas e inspiración para el viaje')}
   ${all.length ? `<div class="chips-scroll" role="group" aria-label="Filtrar enlaces"><button data-lf="all" aria-pressed="${S.linkFilter === 'all'}">Todos · ${all.length}</button>${Object.keys(M.LINK_KINDS).filter(k => counts[k]).map(k => `<button data-lf="${k}" aria-pressed="${S.linkFilter === k}">${M.LINK_KINDS[k]} · ${counts[k]}</button>`).join('')}</div>
     <div class="lk-list">${list.map(card).join('')}</div>`
    : `<div class="empty-state"><span class="es-ico">${ICON.link}</span><b>Guarda aquí tus referencias</b><span class="muted small">Listas de Google Maps, tableros de Pinterest, vídeos de YouTube o TikTok, reels de Instagram… Copia el enlace en la app y pégalo aquí.</span></div>`}
   <button class="btn primary block" id="addLink">${ICON.plus} Añadir enlace</button>
   <div class="muted small">Los enlaces se abren en su app o en el navegador y necesitan conexión. Se incluyen en la copia de seguridad y se conservan al actualizar desde Notion.</div>
  </div>`;
}

/* ----- Menú lateral ----- */
function renderDrawer() {
  const dr = $('#drawer'), t = S.trip;
  const pend = t ? (t.documents || []).filter(x => x.status === 'pending' && !x.files?.length).length : 0;
  const item = (v, ico, label, badge) => `<button class="dr-item" data-go="${v}" aria-current="${S.view === v ? 'page' : 'false'}"><i>${ico}</i><span>${label}</span>${badge ? `<em>${badge}</em>` : ''}</button>`;
  const stt = t ? tripState(t.trip) : null;
  dr.innerHTML = `<div class="dr-scrim" data-drclose></div>
   <aside class="dr-panel" role="dialog" aria-modal="true" aria-label="Menú">
    <div class="dr-head"><img src="icons/logo.svg" alt="" width="40" height="40"><div class="dr-brand">Trip<b>folio</b></div><button class="close" data-drclose aria-label="Cerrar menú">${ICON.x}</button></div>
    ${t ? `<button class="dr-trip" data-go="trips"><span class="eyebrow">${stt.k === 'now' ? 'Viaje en curso' : 'Viaje abierto'}</span><b>${esc(t.trip.name)}</b><span class="muted small">${range(t.trip)}</span><span class="dr-count">${esc(stt.big)}</span><span class="dr-switch">Cambiar ${ICON.chev}</span></button>
    <div class="dr-label">Este viaje</div>
    <nav class="dr-nav">
      ${item('today', ICON.today, 'Hoy')}${item('day', ICON.itin, 'Itinerario', `${t.days.filter(x => x.review).length}/${t.days.length} revisados`)}${item('map', ICON.map, 'Mapa del viaje')}
      ${item('docs', ICON.docs, 'Documentos', pend ? pend + ' pend.' : '')}${item('lists', ICON.lists, 'Checklists')}${item('links', ICON.link, 'Enlaces', (t.userLinks || []).length || '')}
    </nav>` : ''}
    <div class="dr-label">Tripfolio</div>
    <nav class="dr-nav">${item('home', ICON.home, 'Inicio')}${item('trips', ICON.suitcase, 'Mis viajes', S.trips.length || '')}${item('add', ICON.plus, 'Añadir un viaje')}${t ? item('settings', ICON.gear, 'Ajustes y copias') : ''}</nav>
    <div class="dr-foot">Funciona sin conexión · los datos se quedan en este iPhone</div>
   </aside>`;
  dr.classList.toggle('open', S.drawer);
  dr.setAttribute('aria-hidden', String(!S.drawer));
  $('#menuBtn').setAttribute('aria-expanded', String(S.drawer));
}
function setDrawer(open) {
  S.drawer = open;
  const dr = $('#drawer'); dr.classList.toggle('open', open); dr.setAttribute('aria-hidden', String(!open));
  $('#menuBtn').setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => dr.querySelector('.dr-item[aria-current="page"], .dr-item')?.focus({ preventScroll: true }), 260);
}

/* ---------------- Hojas ---------------- */
function renderLayer() {
  const ly = $('#layer');
  if (!S.sheet) { ly.innerHTML = ''; return; }
  const body = S.sheet.type === 'detail' ? sheetDetail() : S.sheet.type === 'add' ? sheetAdd() : S.sheet.type === 'doc' ? sheetDoc() : S.sheet.type === 'newdoc' ? sheetNewDoc() : S.sheet.type === 'import' ? sheetImport() : S.sheet.type === 'link' ? sheetLink() : '';
  ly.innerHTML = `<div class="scrim" id="scrim"></div><div class="sheet gut" role="dialog" aria-modal="true">${body}</div>`;
  if (S.sheet.type === 'doc') loadDocFiles();
}
const head = (eyebrow, title) => `<div class="grab"></div><div class="sh-head"><div style="min-width:0"><div class="eyebrow">${eyebrow}</div><h2>${esc(title)}</h2></div><button class="close" data-close aria-label="Cerrar">${ICON.x}</button></div>`;

function sheetDetail() {
  const f = findItem(S.sheet.id); if (!f) return '';
  const { day: d, item: it, idx } = f;
  const prev = d.items.slice(0, idx).reverse().find(x => x.type !== 'transport'), next = d.items.slice(idx + 1).find(x => x.type !== 'transport');
  const before = idx > 0 && d.items[idx - 1].type === 'transport' ? d.items[idx - 1] : null;
  const prevGeo = d.items.slice(0, idx).reverse().find(x => M.hasGeo(x));
  const order = M.markerOrder(d);
  const tz = it.tz || d.tz;
  const timeTxt = it.start || it.end ? `${it.start || '—'}${it.end ? ' – ' + it.end : ''}${it.endDayOffset ? ' (+1 día)' : ''} · hora de ${tzName(tz)}${it.endTz && it.endTz !== tz ? ` → llegada hora de ${tzName(it.endTz)}` : ''}` : 'Sin hora';
  const docs = (S.trip.documents || []).filter(x => x.itemId === it.id);
  return head(`${order[it.id] ? 'Parada ' + order[it.id] + ' · ' : ''}Día ${d.n} · ${M.TYPES[it.type]}${it.mode ? ' · ' + M.MODES[it.mode] : ''}`, it.title) + `
  <div class="sh-body">
   <div class="row">${critChip(it)}${it.reservation ? resChip(it.reservation) : ''}${localChip(it)}${it.optional ? '<span class="chip">Opcional</span>' : ''}</div>
   <div class="row"><button class="btn ${it.done ? '' : 'primary'}" data-done="${it.id}">${it.done ? 'Hecho · deshacer' : 'Marcar como hecho'}</button>
    ${M.hasGeo(it) || it.location ? `<a class="btn ghost" href="${esc(M.mapsSearchUrl(it.location))}" target="_blank" rel="noopener">Ver en Google Maps</a>` : ''}
    ${it.location && prevGeo && prevGeo !== it ? `<a class="btn ghost" href="${esc(M.mapsDirUrl(prevGeo.location, it.location, before ? before.mode : 'walk'))}" target="_blank" rel="noopener">Cómo llegar</a>` : ''}</div>
   <dl class="kv">
    <dt>Hora</dt><dd class="mono">${esc(timeTxt)}</dd>
    ${M.duration(it, d.tz) ? `<dt>Duración</dt><dd>${M.duration(it, d.tz)}</dd>` : ''}
    <dt>Lugar</dt><dd>${it.location ? esc(it.location.address || it.location.name) + (it.location.verified ? '' : '<div class="muted" style="font-size:12px">Posición en el mapa aproximada</div>') : '<span class="muted">Sin ubicación</span>'}</dd>
    <dt>Reserva</dt><dd>${it.reservation ? resChip(it.reservation) + `<div style="margin-top:4px">${esc(it.reservation.detail || '')}</div>` : '<span class="muted">No consta</span>'}</dd>
    ${before ? `<dt>Llegada</dt><dd>${M.MODES[before.mode] || ''} · ${esc(before.title)}${M.duration(before, d.tz) ? ' · ' + M.duration(before, d.tz) : ''}${before.note ? `<div class="muted small">${esc(before.note)}</div>` : ''}</dd>` : ''}
    ${it.note ? `<dt>Notas</dt><dd>${esc(it.note)}</dd>` : ''}
    ${it.links?.length ? `<dt>Enlaces</dt><dd>${it.links.map(l => `<div><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></div>`).join('')}</dd>` : ''}
    ${docs.length ? `<dt>Documentos</dt><dd>${docs.map(x => `<div><button class="more" style="padding:0;min-height:30px" data-doc="${x.id}">${esc(x.title)}${x.files?.length ? ' · abrir' : x.status === 'pending' ? ' · pendiente' : ''}</button></div>`).join('')}</dd>` : ''}
    ${it.local?.fields?.length ? `<dt>Cambiado</dt><dd class="small">En el móvil: ${it.local.fields.map(f => ({ start: 'inicio', end: 'fin', title: 'título' }[f] || f)).join(', ')}</dd>` : ''}
    <dt>Origen</dt><dd>${it.userAdded ? 'Añadido en el móvil' : `<a href="${esc(d.source?.url || '#')}" target="_blank" rel="noopener">Día ${d.n} en Notion</a>`}</dd>
   </dl>
   <div class="neigh">
     <button ${prev ? `data-open="${prev.id}"` : 'disabled'}><span>Anterior</span><b>${prev ? esc(prev.title) : '—'}</b></button>
     <button ${next ? `data-open="${next.id}"` : 'disabled'}><span>Siguiente</span><b>${next ? esc(next.title) : '—'}</b></button>
   </div>
   <div class="eyebrow">Editar</div>
   <div class="two"><label class="field" for="tStart">Inicio<input type="time" id="tStart" value="${esc(it.start || '')}"></label><label class="field" for="tEnd">Fin<input type="time" id="tEnd" value="${esc(it.end || '')}"></label></div>
   <label class="field" for="tNote">Tu nota${it.type === 'transport' ? ' de transporte' : ''}<textarea id="tNote" placeholder="Algo que quieras recordar en el momento">${esc(it.userNote || '')}</textarea></label>
   <div id="editErr" class="err"></div>
   <div class="row"><button class="btn primary" id="saveItem">Guardar cambios</button><button class="btn danger" id="delItem">Quitar del día</button></div>
   <div id="delConfirm"></div>
  </div>`;
}

function sheetAdd() {
  const d = day();
  return head(`Día ${d.n}`, 'Añadir elemento') + `<div class="sh-body">
   <label class="field" for="aTitle">Nombre<input id="aTitle" autocomplete="off" placeholder="Ej. Cafetería cerca de Nishiki"></label>
   <div class="two"><label class="field" for="aType">Tipo<select id="aType">${Object.entries(M.TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
   <label class="field" for="aMode">Medio (si es traslado)<select id="aMode">${Object.entries(M.MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
   <div class="two"><label class="field" for="aStart">Inicio<input type="time" id="aStart"></label><label class="field" for="aEnd">Fin<input type="time" id="aEnd"></label></div>
   <label class="field" for="aAddr">Dirección o lugar (para Google Maps)<input id="aAddr" autocomplete="off" placeholder="Opcional"></label>
   <label class="field" for="aPos">Posición<select id="aPos"><option value="time">Según la hora de inicio</option>${S.sel ? '<option value="after">Después del elemento seleccionado</option>' : ''}<option value="end">Al final del día</option></select></label>
   <div class="muted small">Sin coordenadas, el elemento aparece en la agenda y abre Google Maps con la dirección, pero no sale en el mapa.</div>
   <div id="addErr" class="err"></div>
   <button class="btn primary block" id="addSave">Añadir al día ${d.n}</button>
  </div>`;
}

function sheetDoc() {
  const x = (S.trip.documents || []).find(o => o.id === S.sheet.id); if (!x) return '';
  const d = x.day ? S.trip.days.find(o => o.id === x.day) : null;
  const it = x.itemId ? findItem(x.itemId)?.item : null;
  return head(d ? `Día ${d.n} · ${fmtDate(d.date)}` : 'Todo el viaje', x.title) + `<div class="sh-body">
   <div class="row">${x.files?.length ? '<span class="chip ok">En el móvil</span>' : x.status === 'pending' ? '<span class="chip crit">Pendiente</span>' : '<span class="chip">En Notion / Drive</span>'}</div>
   ${x.detail ? `<div class="muted small">${esc(x.detail)}</div>` : ''}
   ${it ? `<button class="btn ghost" data-open="${it.id}">Ver «${esc(it.title)}»</button>` : ''}
   <div id="docFiles" class="viewer"><div class="muted small">Cargando…</div></div>
   <label class="btn primary block" for="docFile">${x.files?.length ? 'Añadir otro archivo' : 'Añadir archivo (PDF, imagen o captura)'}</label>
   <input type="file" id="docFile" accept="application/pdf,image/*" hidden>
   ${x.url ? `<a class="btn ghost block" href="${esc(x.url)}" target="_blank" rel="noopener">Abrir origen (${x.url.includes('notion') ? 'Notion' : x.url.includes('drive.google') ? 'Google Drive' : 'web'})</a>` : ''}
   <div id="docErr" class="err"></div>
  </div>`;
}
const objUrls = [];
async function loadDocFiles() {
  objUrls.splice(0).forEach(u => URL.revokeObjectURL(u));
  const box = $('#docFiles'); if (!box) return;
  try {
    const files = await DB.filesForDoc(S.sheet.id);
    if (!files.length) { box.innerHTML = '<div class="muted small">Aún no hay archivos guardados en el móvil para este documento.</div>'; return; }
    box.innerHTML = files.map(f => {
      const u = URL.createObjectURL(f.blob); objUrls.push(u);
      const view = f.type.startsWith('image/') ? `<img src="${u}" alt="${esc(f.name)}">` : f.type === 'application/pdf' ? `<iframe src="${u}" title="${esc(f.name)}"></iframe>` : '';
      return `<div class="stack" style="gap:6px">${view}<div class="row"><a class="btn ghost" href="${u}" target="_blank" rel="noopener">Abrir ${esc(f.name)}</a><button class="btn danger" data-delfile="${f.id}">Quitar</button></div></div>`;
    }).join('');
  } catch (e) { box.innerHTML = `<div class="err">No se pudieron leer los archivos: ${esc(e.message)}</div>`; }
}

function sheetNewDoc() {
  return head('Documentos', 'Añadir documento') + `<div class="sh-body">
   <label class="field" for="nTitle">Nombre<input id="nTitle" autocomplete="off" placeholder="Ej. Reserva restaurante Gion"></label>
   <label class="field" for="nDay">Día<select id="nDay"><option value="">Todo el viaje</option>${S.trip.days.map(x => `<option value="${x.id}" ${x.id === day().id ? 'selected' : ''}>Día ${x.n} · ${fmtDate(x.date)} · ${esc(x.title)}</option>`).join('')}</select></label>
   <label class="field" for="nKind">Tipo<select id="nKind"><option value="entrada">Entrada / reserva</option><option value="transporte">Transporte</option><option value="alojamiento">Alojamiento</option><option value="tramite">Trámite</option><option value="identidad">Identidad</option><option value="otro">Otro</option></select></label>
   <div id="ndErr" class="err"></div>
   <button class="btn primary block" id="ndSave">Crear y añadir archivo</button>
  </div>`;
}

function sheetLink() {
  const l = S.sheet.id ? (S.trip.userLinks || []).find(x => x.id === S.sheet.id) : null;
  const canPaste = !!navigator.clipboard?.readText;
  return head('Enlaces', l ? 'Editar enlace' : 'Añadir enlace') + `<div class="sh-body">
   <label class="field" for="lUrl">Enlace<div class="paste-row"><input id="lUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://…" value="${esc(l?.url || '')}">${canPaste ? '<button class="btn" id="lPaste" type="button">Pegar</button>' : ''}</div></label>
   <div id="lKind" class="lkind">${l ? kindBadge(l.url) : '<span class="muted small">Pega un enlace de Google Maps, Pinterest, TikTok, Instagram, YouTube o cualquier web.</span>'}</div>
   <label class="field" for="lTitle">Título<input id="lTitle" autocomplete="off" placeholder="${l ? '' : 'Se rellena solo si lo dejas vacío'}" value="${esc(l?.title || '')}"></label>
   <label class="field" for="lDay">Día (opcional)<select id="lDay"><option value="">Todo el viaje</option>${S.trip.days.map(x => `<option value="${x.id}" ${l?.day === x.id ? 'selected' : ''}>Día ${x.n} · ${fmtDate(x.date)} · ${esc(x.title)}</option>`).join('')}</select></label>
   <label class="field" for="lNote">Nota<textarea id="lNote" placeholder="Por qué lo guardas, qué pedir, a qué hora ir…">${esc(l?.note || '')}</textarea></label>
   <div id="lErr" class="err"></div>
   <button class="btn primary block" id="lSave">${l ? 'Guardar cambios' : 'Añadir enlace'}</button>
   ${l ? `<button class="btn danger block" id="lDel">Borrar enlace</button>` : ''}
  </div>`;
}
const kindBadge = url => { const k = M.linkKind(url); return `<span class="chip k-${k}"><i class="ci">${LINK_ICON[k]}</i>${M.LINK_KINDS[k]}</span>`; };

function sheetImport() {
  const p = S.sheet.pending;
  const s = p.summary;
  return head(p.kind === 'backup' ? 'Restaurar copia' : 'Importar viaje', p.data.trip.name) + `<div class="sh-body">
   ${p.kind === 'backup' ? `<div class="small">Se restaurará el viaje tal como estaba en la copia del ${esc(new Date(p.data.exportedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }))}${p.replaces ? ', <b>sustituyendo</b> lo que hay ahora en el móvil para este viaje' : ''}.</div>
     <div class="small">${M.tripCounts(p.data).days} días · ${M.tripCounts(p.data).items} elementos · ${M.tripCounts(p.data).done} hechos${p.data.files?.length ? ` · ${p.data.files.length} archivos` : ''}</div>`
    : p.replaces ? `<div class="small">Se fusionará con tu copia actual:</div>
     <ul class="limits"><li>${s.added} elementos nuevos</li><li>${s.updated} elementos actualizados</li><li>${s.kept} con cambios tuyos que se conservan</li>${s.localOnly ? `<li>${s.localOnly} añadidos por ti que se mantienen</li>` : ''}${s.missing ? `<li>${s.missing} que ya no están en Notion: se mantienen marcados, no se borran</li>` : ''}</ul>
     ${p.conflicts.length ? `<div class="warn">${p.conflicts.length} conflicto${p.conflicts.length > 1 ? 's' : ''}: se mantiene tu versión y podrás elegir después en Ajustes y copias.</div>` : ''}
     <div class="muted small">Se conservan las marcas de hecho, tus notas, los checklists y los archivos de documentos.</div>`
    : `<div class="small">${M.tripCounts(p.data).days} días · ${M.tripCounts(p.data).items} elementos · ${M.tripCounts(p.data).docs} documentos · ${M.tripCounts(p.data).lists} checklists</div>`}
   <button class="btn primary block" id="importApply">${p.kind === 'backup' ? 'Restaurar' : p.replaces ? 'Aplicar actualización' : 'Importar viaje'}</button>
   <button class="btn ghost block" data-close>Cancelar</button>
  </div>`;
}

/* ---------------- Acciones ---------------- */
function openDetail(id) { const f = findItem(id); if (!f) return; S.sel = id; S.day = S.trip.days.indexOf(f.day); S.sheet = { type: 'detail', id }; render(); }

async function handleImportFile(file) {
  const msg = $('#importMsg');
  try {
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('El archivo no es un JSON válido.'); }
    const errs = M.validateTrip(data);
    if (errs.length) { msg.innerHTML = `<div class="err">No se puede importar:<br>${errs.slice(0, 6).map(esc).join('<br>')}${errs.length > 6 ? `<br>…y ${errs.length - 6} más` : ''}</div>`; return; }
    const existing = await DB.kvGet('trip:' + data.trip.id);
    if (data.kind === 'backup') { S.sheet = { type: 'import', pending: { kind: 'backup', data, replaces: !!existing } }; renderLayer(); return; }
    const base = await DB.kvGet('base:' + data.trip.id);
    const { trip, summary, conflicts } = M.mergeImport(existing, data, base);
    S.sheet = { type: 'import', pending: { kind: 'trip', data, merged: trip, summary, conflicts, replaces: !!existing } };
    renderLayer();
  } catch (e) { msg.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

async function applyImport() {
  const p = S.sheet.pending;
  try {
    let trip;
    if (p.kind === 'backup') {
      const { files, kind, ...rest } = p.data;
      trip = { ...rest, kind: 'trip' };
      if (files?.length) for (const f of files) {
        const blob = await (await fetch(f.dataUrl)).blob();
        await DB.fileAdd({ id: f.id, docId: f.docId, name: f.name, type: f.type, blob, addedAt: f.addedAt });
      }
      if (p.data.base) await DB.kvSet('base:' + trip.trip.id, p.data.base);
      delete trip.base;
    } else {
      trip = p.merged;
      trip.conflicts = [...(p.conflicts || [])];
      await DB.kvSet('base:' + trip.trip.id, p.data);
    }
    await DB.kvSet('trip:' + trip.trip.id, trip);
    const meta = { id: trip.trip.id, name: trip.trip.name, startDate: trip.trip.startDate, endDate: trip.trip.endDate };
    S.trips = [...S.trips.filter(x => x.id !== meta.id), meta].sort((a, b) => a.startDate.localeCompare(b.startDate));
    await DB.kvSet('trips', S.trips);
    await DB.kvSet('active', meta.id);
    await loadTrip(meta.id);
    S.sheet = null; S.view = 'today'; S.error = null; S.tripSel = null;
    render();
    toast(p.kind === 'backup' ? 'Copia restaurada' : 'Viaje importado');
  } catch (e) { toast('No se pudo importar: ' + e.message, 4000); }
}

async function exportBackup(withFiles) {
  const msg = $('#backupMsg');
  try {
    msg.textContent = 'Preparando copia…';
    const out = { ...structuredClone(S.trip), kind: 'backup', exportedAt: new Date().toISOString(), base: S.base || null };
    if (withFiles) {
      out.files = [];
      for (const doc of S.trip.documents || []) for (const f of await DB.filesForDoc(doc.id)) {
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f.blob); });
        out.files.push({ id: f.id, docId: f.docId, name: f.name, type: f.type, addedAt: f.addedAt, dataUrl });
      }
    }
    const name = `copia-${S.trip.trip.id}-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([JSON.stringify(out)], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); msg.textContent = 'Copia lista. Guárdala en Archivos o iCloud.'; return; }
      catch (e) { if (e.name === 'AbortError') { msg.textContent = 'Copia cancelada.'; return; } }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    msg.textContent = `Descargada: ${name}`;
  } catch (e) { msg.textContent = 'No se pudo crear la copia: ' + e.message; }
}

let mapsAbort = null, tileTemplate = null;
function mapEstimate() {
  const n = tilesForTrip(S.trip, '{z}/{x}/{y}').length;
  return `${n} teselas, ≈ ${Math.max(1, Math.round(n * 0.045))} MB`;
}
async function downloadMaps() {
  const box = $('#mapsDl'); if (!box) return;
  if (!navigator.onLine) { box.insertAdjacentHTML('beforeend', '<div class="err">Necesitas conexión para descargar los mapas.</div>'); return; }
  mapsAbort = new AbortController();
  box.innerHTML = '<div class="prog"><i id="dlBar" style="width:0%"></i></div><div class="muted small" id="dlTxt">Preparando…</div><button class="btn ghost" id="offlineStop">Detener</button>';
  try {
    const r = await prefetchTrip(S.trip, p => {
      const bar = $('#dlBar'), txt = $('#dlTxt'); if (!bar) return;
      bar.style.width = (p.done / p.total * 100).toFixed(1) + '%';
      txt.textContent = `${p.done} de ${p.total} · ${(p.bytes / 1048576).toFixed(1)} MB${p.failed ? ` · ${p.failed} fallidas` : ''}`;
    }, mapsAbort.signal);
    await DB.kvSet('mapsAt:' + S.trip.trip.id, new Date().toISOString());
    box.innerHTML = `<div class="small">${mapsAbort.signal.aborted ? 'Descarga detenida.' : 'Mapas guardados.'} ${(r.bytes / 1048576).toFixed(1)} MB${r.failed ? ` · ${r.failed} teselas no se pudieron descargar: vuelve a intentarlo` : ''}.</div><button class="btn ghost" id="offlineMaps">Volver a descargar</button>`;
  } catch (e) {
    box.innerHTML = `<div class="err">${mapsAbort.signal.aborted ? 'Descarga detenida.' : 'No se pudo descargar: ' + esc(e.message)}</div><button class="btn ghost" id="offlineMaps">Reintentar</button>`;
  }
  showStorage();
}
async function showStorage() {
  const el = $('#storageInfo'); if (!el) return;
  const est = await DB.storageEstimate();
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const mapsAt = await DB.kvGet('mapsAt:' + S.trip.trip.id).catch(() => null);
  el.textContent = `${est ? `Usado ${(est.usage / 1048576).toFixed(1)} MB. ` : ''}${mapsAt ? `Mapas descargados el ${new Date(mapsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}. ` : 'Mapas aún no descargados. '}${persisted ? 'Datos protegidos frente al borrado automático.' : 'iOS podría borrar los datos si no usas la app en semanas: instala la app en la pantalla de inicio y guarda copias.'}`;
}

/* ---------------- Eventos ---------------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-sel],a[data-x],#scrim');
  if (!t) return;
  if (t.id === 'scrim' || t.hasAttribute('data-close')) { S.sheet = null; renderLayer(); return; }
  if (t.hasAttribute('data-drclose')) { setDrawer(false); return; }
  if (t.id === 'menuBtn' || t.id === 'tripsBtn') { setDrawer(!S.drawer); return; }
  const go = v => { S.view = v; S.sheet = null; S.full = false; S.drawer = false; render(); $('#main').scrollTop = 0; };
  if (t.dataset.view) { go(t.dataset.view); return; }
  if (t.dataset.go) { go(t.dataset.go); return; }
  if (t.dataset.trip) { await DB.kvSet('active', t.dataset.trip); await loadTrip(t.dataset.trip); S.tripSel = null; S.linkFilter = 'all'; go('today'); return; }
  if (t.id === 'importApply') { await applyImport(); return; }
  if (!S.trip) return;
  if (t.dataset.goview) { S.view = t.dataset.goview; render(); $('#main').scrollTop = 0; return; }
  if (t.dataset.goday !== undefined) { S.day = +t.dataset.goday; S.view = 'day'; S.sel = null; render(); $('#main').scrollTop = 0; return; }
  if (t.dataset.day !== undefined) { S.day = +t.dataset.day; S.sel = null; render(); return; }
  if (t.dataset.docf) { S.docFilter = t.dataset.docf; render(); return; }
  if (t.dataset.tday !== undefined) { S.tripSel = t.dataset.tday === 'all' ? null : +t.dataset.tday; render(); return; }
  if (t.dataset.tstep) { S.tripSel = Math.max(0, Math.min(S.trip.days.length - 1, S.tripSel + +t.dataset.tstep)); render(); return; }
  if (t.dataset.lf) { S.linkFilter = t.dataset.lf; render(); return; }
  if (t.dataset.linkedit) { S.sheet = { type: 'link', id: t.dataset.linkedit }; renderLayer(); return; }
  if (t.dataset.lt) { S.listTab = t.dataset.lt; render(); return; }
  if (t.dataset.ck) {
    for (const c of S.trip.checklists) for (const s of c.sections) for (const i of s.items) if (i.id === t.dataset.ck) { i.done = !i.done; S.openCl = c.id; }
    save(); const y = $('#main').scrollTop; render(); $('#main').scrollTop = y; return;
  }
  if (t.dataset.done) {
    const f = findItem(t.dataset.done); f.item.done = !f.item.done; save();
    const y = $('#main').scrollTop; render(); $('#main').scrollTop = y;
    toast(f.item.done ? 'Marcado como hecho' : 'Marcado como pendiente'); return;
  }
  if (t.dataset.open) { openDetail(t.dataset.open); return; }
  if (t.dataset.doc) { S.sheet = { type: 'doc', id: t.dataset.doc }; renderLayer(); return; }
  if (t.dataset.sel) { S.sel = S.sel === t.dataset.sel ? null : t.dataset.sel; const y = $('#main').scrollTop; render(); $('#main').scrollTop = y; return; }
  if (t.dataset.mv) {
    const d = day(), i = d.items.findIndex(x => x.id === t.dataset.id), j = i + +t.dataset.mv;
    if (j < 0 || j >= d.items.length) return;
    [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    d.items[j].local = { ...(d.items[j].local || {}), moved: true, fields: d.items[j].local?.fields || [], at: new Date().toISOString() };
    S.sel = t.dataset.id; save(); const y = $('#main').scrollTop; render(); $('#main').scrollTop = y; return;
  }
  if (t.dataset.conf !== undefined) {
    const c = S.trip.conflicts[+t.dataset.conf], f = findItem(c.itemId);
    if (f && t.dataset.keep === 'incoming') { f.item[c.field] = c.incoming; f.item.local.fields = f.item.local.fields.filter(x => x !== c.field); }
    S.trip.conflicts.splice(+t.dataset.conf, 1); save(); render(); return;
  }
  if (t.dataset.delfile) { await DB.fileDel(t.dataset.delfile); const doc = S.trip.documents.find(o => o.id === S.sheet.id); doc.files = (doc.files || []).filter(x => x !== t.dataset.delfile); save(); renderLayer(); render(); return; }
  if (t.dataset.lodging !== undefined) { const lod = day().lodging; window.open(M.mapsSearchUrl(lod), '_blank', 'noopener'); return; }
  switch (t.id) {
    case 'editBtn': S.edit = !S.edit; render(); break;
    case 'fullBtn': S.full = true; render(); break;
    case 'fullClose': S.full = false; render(); break;
    case 'tmFit': S.tripSel != null ? tmap?.fitDay(S.tripSel) : tmap?.fitAll(); break;
    case 'addLink': S.sheet = { type: 'link', id: null }; renderLayer(); setTimeout(() => $('#lUrl')?.focus(), 250); break;
    case 'lPaste': {
      try { const txt = await navigator.clipboard.readText(); const u = M.normalizeUrl(txt); if (u) { $('#lUrl').value = u; $('#lKind').innerHTML = kindBadge(u); $('#lErr').textContent = ''; } else $('#lErr').textContent = 'Lo que hay copiado no parece un enlace.'; }
      catch { $('#lErr').textContent = 'No se pudo leer el portapapeles. Mantén pulsado el campo y elige «Pegar».'; }
      break;
    }
    case 'lSave': {
      const url = M.normalizeUrl($('#lUrl').value);
      if (!url) { $('#lErr').textContent = 'Escribe o pega un enlace válido.'; $('#lUrl').focus(); return; }
      const rec = { url, title: $('#lTitle').value.trim() || M.linkDefaultTitle(url), day: $('#lDay').value || null, note: $('#lNote').value.trim() || undefined };
      const ls = S.trip.userLinks = S.trip.userLinks || [];
      const cur = S.sheet.id ? ls.find(x => x.id === S.sheet.id) : null;
      if (cur) Object.assign(cur, rec); else ls.unshift({ id: 'lk' + Date.now().toString(36), addedAt: new Date().toISOString(), ...rec });
      save(); S.sheet = null; render(); toast(cur ? 'Enlace actualizado' : 'Enlace guardado'); break;
    }
    case 'lDel': $('#lDel').outerHTML = '<div class="confirm"><span style="flex:1;min-width:150px;font-size:13.5px">¿Borrar este enlace?</span><button class="btn danger" id="lDelYes">Borrar</button><button class="btn" data-close>Cancelar</button></div>'; break;
    case 'lDelYes': S.trip.userLinks = (S.trip.userLinks || []).filter(x => x.id !== S.sheet.id); save(); S.sheet = null; render(); toast('Enlace borrado'); break;
    case 'fitBtn': map?.fitDay(day()); break;
    case 'offlineMaps': downloadMaps(); break;
    case 'offlineStop': mapsAbort?.abort(); break;
    case 'addItem': S.sheet = { type: 'add' }; renderLayer(); break;
    case 'addDoc': S.sheet = { type: 'newdoc' }; renderLayer(); break;
    case 'saveItem': {
      const f = findItem(S.sheet.id), st = $('#tStart').value, en = $('#tEnd').value;
      if (st && en && M.toMin(en) < M.toMin(st) && !f.item.endDayOffset && !f.item.endTz) { $('#editErr').textContent = 'La hora de fin es anterior a la de inicio. Corrígela o déjala vacía.'; return; }
      const patch = {}; if (st !== (f.item.start || '')) patch.start = st || null; if (en !== (f.item.end || '')) patch.end = en || null;
      let it = Object.keys(patch).length ? M.editItem(f.item, patch) : f.item;
      it = { ...it, userNote: $('#tNote').value.trim() || undefined };
      f.day.items[f.idx] = it; save(); S.sheet = null; render(); toast('Cambios guardados'); break;
    }
    case 'delItem': $('#delConfirm').innerHTML = '<div class="confirm"><span style="flex:1;min-width:150px;font-size:13.5px">¿Quitar este elemento del día? Una nueva importación de Notion lo volverá a añadir.</span><button class="btn danger" id="delYes">Quitar</button><button class="btn" id="delNo">Cancelar</button></div>'; break;
    case 'delNo': $('#delConfirm').innerHTML = ''; break;
    case 'delYes': { const f = findItem(S.sheet.id); f.day.items.splice(f.idx, 1); S.sel = null; S.sheet = null; save(); render(); toast('Elemento quitado'); break; }
    case 'addSave': {
      const title = $('#aTitle').value.trim();
      if (!title) { $('#addErr').textContent = 'Escribe un nombre.'; $('#aTitle').focus(); return; }
      const st = $('#aStart').value, en = $('#aEnd').value;
      if (st && en && M.toMin(en) < M.toMin(st)) { $('#addErr').textContent = 'La hora de fin es anterior a la de inicio.'; return; }
      const d = day(), type = $('#aType').value, addr = $('#aAddr').value.trim();
      const it = { id: `${d.id}-u${Date.now().toString(36)}`, type, title, start: st || null, end: en || null, done: false, planning: null, userAdded: true };
      if (type === 'transport') it.mode = $('#aMode').value;
      if (addr) it.location = { name: title, address: addr, lat: null, lng: null, verified: false };
      let pos = d.items.length;
      const how = $('#aPos').value;
      if (how === 'after' && S.sel) pos = d.items.findIndex(x => x.id === S.sel) + 1;
      else if (how === 'time' && st) { const m = M.toMin(st); const k = d.items.findIndex(x => M.toMin(x.start) != null && M.toMin(x.start) > m); if (k > -1) pos = k; }
      d.items.splice(pos, 0, it); S.sel = it.id; S.sheet = null; save(); render(); toast('Añadido al día ' + d.n); break;
    }
    case 'ndSave': {
      const title = $('#nTitle').value.trim(); if (!title) { $('#ndErr').textContent = 'Escribe un nombre.'; return; }
      const doc = { id: 'doc-u' + Date.now().toString(36), title, kind: $('#nKind').value, status: 'pending', detail: 'Añadido en el móvil', day: $('#nDay').value || null, itemId: null, files: [], userAdded: true };
      S.trip.documents = [...(S.trip.documents || []), doc]; save(); S.sheet = { type: 'doc', id: doc.id }; render(); break;
    }
    case 'backupBtn': exportBackup(false); break;
    case 'backupFilesBtn': exportBackup(true); break;
    case 'deleteTrip': $('#dangerArea').innerHTML = '<div class="confirm"><span style="flex:1;min-width:150px;font-size:13.5px">Se borrarán el viaje, tus cambios y sus archivos de este iPhone. Exporta antes una copia si la quieres conservar.</span><button class="btn danger" id="delTripYes">Borrar</button><button class="btn" id="delTripNo">Cancelar</button></div>'; break;
    case 'delTripNo': render(); break;
    case 'delTripYes': {
      const id = S.trip.trip.id;
      for (const doc of S.trip.documents || []) for (const f of await DB.filesForDoc(doc.id)) await DB.fileDel(f.id);
      await DB.kvDel('trip:' + id); await DB.kvDel('base:' + id);
      S.trips = S.trips.filter(x => x.id !== id); await DB.kvSet('trips', S.trips);
      const next = S.trips[0]?.id || null; await DB.kvSet('active', next);
      S.trip = null; if (next) await loadTrip(next);
      S.view = 'home'; render(); toast('Viaje borrado del móvil'); break;
    }
  }
});

document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'pvDay') { S.preview = { day: +t.value, min: null }; S.day = +t.value; render(); }
  if (t.id === 'pvTime' && t.value) { S.preview.min = M.toMin(t.value); render(); }
  if (t.id === 'importFile' && t.files[0]) { await handleImportFile(t.files[0]); t.value = ''; }
  if (t.id === 'docFile' && t.files[0]) {
    const file = t.files[0], doc = S.trip.documents.find(o => o.id === S.sheet.id);
    if (file.size > 25 * 1048576) { $('#docErr').textContent = 'El archivo supera 25 MB. Usa una versión más ligera o una captura.'; return; }
    try {
      const rec = { id: 'f' + Date.now().toString(36), docId: doc.id, name: file.name, type: file.type || 'application/octet-stream', blob: file, addedAt: new Date().toISOString() };
      await DB.fileAdd(rec);
      doc.files = [...(doc.files || []), rec.id]; save(); renderLayer(); render(); toast('Archivo guardado en el móvil');
    } catch (err) { $('#docErr').textContent = 'No se pudo guardar el archivo: ' + err.message; }
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'lUrl') { const u = M.normalizeUrl(e.target.value); const k = $('#lKind'); if (k) k.innerHTML = u ? kindBadge(u) : ''; }
});
document.addEventListener('toggle', e => { if (e.target.matches?.('details.cl') && e.target.open) S.openCl = e.target.dataset.cl; }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.drawer) setDrawer(false); else if (S.sheet) { S.sheet = null; renderLayer(); } else if (S.full) { S.full = false; render(); } }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-sel][role=button]')) { e.preventDefault(); e.target.click(); }
});
// Gestos: deslizar desde el borde izquierdo abre el menú; deslizar a la izquierda lo cierra.
let touch0 = null;
document.addEventListener('touchstart', e => {
  const p = e.touches[0];
  touch0 = { x: p.clientX, y: p.clientY, edge: !S.drawer && p.clientX < 22 && !S.full && !S.sheet && S.view !== 'map', open: S.drawer };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!touch0) return;
  const p = e.changedTouches[0], dx = p.clientX - touch0.x, dy = Math.abs(p.clientY - touch0.y);
  if (touch0.edge && dx > 60 && dy < 50) setDrawer(true);
  else if (touch0.open && dx < -60 && dy < 60) setDrawer(false);
  touch0 = null;
}, { passive: true });
addEventListener('online', () => { S.online = true; tick(); });
addEventListener('offline', () => { S.online = false; tick(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.trip && S.view === 'today') render(); });

/* ---------------- Service worker y actualizaciones ---------------- */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const prompt = w => {
      if (document.querySelector('.update-bar')) return;
      const bar = document.createElement('div'); bar.className = 'update-bar';
      bar.innerHTML = '<span>Nueva versión de la app</span><button class="btn">Actualizar</button>';
      bar.querySelector('button').onclick = () => w.postMessage('skipWaiting');
      document.body.appendChild(bar);
    };
    if (reg.waiting) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 3600e3);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

boot();
