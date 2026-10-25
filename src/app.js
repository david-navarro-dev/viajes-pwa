// Tripfolio · app principal (sin dependencias de compilación).
import * as M from './model.js';
import * as DB from './db.js';
import { DayMap, prefetchTrip, tilesForTrip } from './map.js';

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
};
const KIND = { identidad: 'ID', transporte: 'TRN', entrada: 'ENT', alojamiento: 'HTL', tramite: 'TRM', carpeta: 'DIR', otro: 'DOC' };

/* ---------------- Estado ---------------- */
const S = {
  trip: null, base: null, trips: [], view: 'today', day: 0, sel: null, edit: false, full: false,
  preview: { day: null, min: null }, sheet: null, docFilter: 'day', listTab: 'day', openCl: null,
  online: navigator.onLine, error: null,
};
let map = null, mapEl = null, saveTimer = null;

async function boot() {
  try {
    S.trips = (await DB.kvGet('trips')) || [];
    const active = await DB.kvGet('active');
    if (active) await loadTrip(active);
    DB.requestPersist();
  } catch (e) { S.error = e.message; }
  const r = S.trip ? M.currentDayIndex(S.trip) : -1;
  if (r > -1) S.day = r;
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
function render() {
  document.querySelectorAll('nav.bottom button').forEach(b => b.setAttribute('aria-current', b.dataset.view === S.view ? 'page' : 'false'));
  $('nav.bottom').hidden = !S.trip;
  if (S.trip) {
    $('#tripName').textContent = S.trip.trip.name;
    $('#tripSub').textContent = `${fmtDate(S.trip.trip.startDate, { day: 'numeric', month: 'short' })} – ${fmtDate(S.trip.trip.endDate, { day: 'numeric', month: 'short' })} · ${S.trip.days.length} ${S.trip.days.length === 1 ? 'día' : 'días'}`;
  } else { $('#tripName').textContent = 'Tripfolio'; $('#tripSub').textContent = 'Sin viaje cargado'; }
  const m = $('#main');
  if (map && mapEl && mapEl.parentNode) mapEl.parentNode.removeChild(mapEl);
  if (!S.trip || S.view === 'trips') m.innerHTML = viewTrips();
  else if (S.view === 'today') m.innerHTML = viewToday();
  else if (S.view === 'day') m.innerHTML = viewDay();
  else if (S.view === 'docs') m.innerHTML = viewDocs();
  else if (S.view === 'lists') m.innerHTML = viewLists();
  if (S.trip && S.view === 'day') mountMap();
  renderLayer();
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
  const strip = S.trip.days.map((x, i) => `<button class="daypill ${x.kind === 'transit' ? 'transit' : ''} ${i === real ? 'today' : ''}" data-day="${i}" aria-current="${i === S.day}" aria-label="Día ${x.n}, ${fmtDate(x.date, { day: 'numeric', month: 'long' })}"><span class="n">DÍA ${x.n}</span><span class="d">${new Date(x.date + 'T12:00:00Z').getUTCDate()} ${fmtDate(x.date, { month: 'short' }).replace('.', '')}</span></button>`).join('');
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
   <div class="dayhead"><div style="min-width:0"><div class="eyebrow">Día ${d.n} · ${esc(fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div><h2>${esc(d.title)}</h2></div>
     <button class="toggle-edit" id="editBtn" aria-pressed="${S.edit}">${S.edit ? 'Listo' : 'Editar'}</button></div>
   ${lod.name ? `<button class="lodging-strip" ${lod.lat != null ? 'data-lodging' : ''}><span class="ico">H</span><div><div class="nm">${esc(lod.name)}</div><div class="muted" style="font-size:12px">${lod.checkin ? 'Check-in ' + esc(lod.checkin) + ' · ' : ''}Alojamiento de esta noche</div></div></button>` : ''}
   ${d.note ? `<div class="daynote">${esc(d.note)}</div>` : ''}
   <div class="mapwrap ${S.full ? 'full' : ''}" id="mapwrap">
     <div id="mapSlot"></div>
     <div class="map-legend"><span><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#A3ABB5" stroke-width="2" stroke-dasharray="4 3"/></svg>A pie</span><span><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#7FA8E6" stroke-width="2.4"/></svg>Transporte</span><span>Líneas = orden, no ruta</span></div>
     <div class="map-status" id="mapStatus" hidden></div>
     <div class="map-tools"><button class="map-btn" id="fullBtn" aria-label="${S.full ? 'Volver a mapa y agenda' : 'Mapa a pantalla completa'}">${S.full ? ICON.shrink : ICON.expand}</button><button class="map-btn" id="fitBtn" aria-label="Encuadrar el día">${ICON.fit}</button></div>
     ${S.full ? `<div class="fm-chips">${d.items.filter(i => order[i.id]).map(i => `<button class="${S.sel === i.id ? 'sel' : ''}" data-sel="${i.id}"><span class="mono">${order[i.id]}</span>${esc(i.title)}</button>`).join('')}</div>` : ''}
   </div>
   <div class="timeline">${html}
     ${S.edit ? `<button class="btn ghost block" id="addItem">+ Añadir elemento al día ${d.n}</button>` : ''}
   </div>
   <div class="muted small" style="padding-bottom:24px"><a href="${esc(d.source?.url || '#')}" target="_blank" rel="noopener">Abrir el día ${d.n} en Notion</a></div>
  </div>`;
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
   <div class="notice">Los archivos que añades (PDF, capturas, QR) se guardan solo en este iPhone y se abren sin conexión. No se suben a ningún sitio. Haz una copia de seguridad con archivos desde Viajes.</div>
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

/* ----- Viajes, importar y copias ----- */
function viewTrips() {
  const welcome = !S.trip;
  const t = S.trip, c = t ? M.tripCounts(t) : null;
  const conf = t?.conflicts || [];
  return `<div class="${welcome ? 'welcome' : 'trips'} gut">
   ${welcome ? `<div class="eyebrow">Planificador de viajes</div><h1>Carga tu viaje para empezar</h1>
     <p class="muted" style="margin:0">Importa el archivo JSON del viaje (por ejemplo <span class="mono">japon-2026.json</span>). Se guarda solo en este iPhone y funciona sin conexión.</p>` : '<div class="eyebrow">Tus viajes</div>'}
   ${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}
   ${S.trips.map(x => `<button class="tripcard ${t && t.trip.id === x.id ? 'active' : ''}" data-trip="${x.id}"><h3>${esc(x.name)}</h3><div class="muted small">${fmtDate(x.startDate, { day: 'numeric', month: 'long' })} – ${fmtDate(x.endDate, { day: 'numeric', month: 'long', year: 'numeric' })}</div>${t && t.trip.id === x.id ? `<div class="small">${c.days} días · ${c.items} elementos · ${c.done} hechos · ${c.docs} documentos</div><div class="muted small">Importado de ${esc(t.trip.source?.title || 'archivo')} · ${t.exportedAt ? new Date(t.exportedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</div>` : '<div class="muted small">Toca para abrirlo</div>'}</button>`).join('')}
   ${conf.length ? `<div class="panel"><div class="eyebrow">Conflictos de la última importación · ${conf.length}</div><div class="muted small">Cambiaste estos datos en el móvil y Notion también los cambió. Ahora se muestra tu versión.</div>
     ${conf.map((x, i) => `<div class="conf"><div><b>${esc(x.title)}</b> · ${esc(x.field)}</div><div class="small">Tuyo: <span class="mono">${esc(x.local ?? '—')}</span> · Notion: <span class="mono">${esc(x.incoming ?? '—')}</span></div><div class="row"><button class="btn" data-conf="${i}" data-keep="local">Mantener el mío</button><button class="btn ghost" data-conf="${i}" data-keep="incoming">Usar el de Notion</button></div></div>`).join('')}</div>` : ''}
   <div class="panel">
     <div class="eyebrow">${welcome ? 'Importar' : 'Actualizar o añadir un viaje'}</div>
     <div class="muted small">${welcome ? 'Elige el archivo desde Archivos, iCloud o AirDrop.' : 'Un archivo de Notion actualizado se fusiona con tus cambios: conserva lo hecho, tus notas y lo que hayas añadido, y te avisa de los conflictos. Una copia de seguridad restaura el viaje tal como lo guardaste.'}</div>
     <label class="btn primary block" for="importFile">Elegir archivo JSON</label>
     <input type="file" id="importFile" accept="application/json,.json" hidden>
     <div id="importMsg"></div>
   </div>
   ${t ? `<div class="panel">
     <div class="eyebrow">Copia de seguridad</div>
     <div class="muted small">Guarda tus marcas, notas y cambios. Hazla antes de borrar datos o cambiar de móvil.</div>
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
   </div>` : ''}
   <div class="panel">
     <div class="eyebrow">Límites</div>
     <ul class="limits">
       <li>Las posiciones del mapa son aproximadas y las líneas indican el orden, no la ruta. Las rutas reales las calcula Google Maps al abrirlo.</li>
       <li>Sin conexión, la agenda, documentos y checklists funcionan; el mapa base solo muestra zonas ya vistas, y Google Maps necesita internet.</li>
       <li>Los cambios se guardan solo en este iPhone y no vuelven a Notion.</li>
       <li>Si iOS borra los datos de la web, se recuperan con la copia de seguridad.</li>
     </ul>
   </div>
  </div>`;
}

/* ---------------- Hojas ---------------- */
function renderLayer() {
  const ly = $('#layer');
  if (!S.sheet) { ly.innerHTML = ''; return; }
  const body = S.sheet.type === 'detail' ? sheetDetail() : S.sheet.type === 'add' ? sheetAdd() : S.sheet.type === 'doc' ? sheetDoc() : S.sheet.type === 'newdoc' ? sheetNewDoc() : S.sheet.type === 'import' ? sheetImport() : '';
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

function sheetImport() {
  const p = S.sheet.pending;
  const s = p.summary;
  return head(p.kind === 'backup' ? 'Restaurar copia' : 'Importar viaje', p.data.trip.name) + `<div class="sh-body">
   ${p.kind === 'backup' ? `<div class="small">Se restaurará el viaje tal como estaba en la copia del ${esc(new Date(p.data.exportedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }))}${p.replaces ? ', <b>sustituyendo</b> lo que hay ahora en el móvil para este viaje' : ''}.</div>
     <div class="small">${M.tripCounts(p.data).days} días · ${M.tripCounts(p.data).items} elementos · ${M.tripCounts(p.data).done} hechos${p.data.files?.length ? ` · ${p.data.files.length} archivos` : ''}</div>`
    : p.replaces ? `<div class="small">Se fusionará con tu copia actual:</div>
     <ul class="limits"><li>${s.added} elementos nuevos</li><li>${s.updated} elementos actualizados</li><li>${s.kept} con cambios tuyos que se conservan</li>${s.localOnly ? `<li>${s.localOnly} añadidos por ti que se mantienen</li>` : ''}${s.missing ? `<li>${s.missing} que ya no están en Notion: se mantienen marcados, no se borran</li>` : ''}</ul>
     ${p.conflicts.length ? `<div class="warn">${p.conflicts.length} conflicto${p.conflicts.length > 1 ? 's' : ''}: se mantiene tu versión y podrás elegir después en Viajes.</div>` : ''}
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
    S.sheet = null; S.view = 'today'; S.error = null;
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
  if (t.dataset.view) { S.view = t.dataset.view; S.sheet = null; S.full = false; render(); $('#main').scrollTop = 0; return; }
  if (t.id === 'tripsBtn') { S.view = 'trips'; S.sheet = null; S.full = false; render(); $('#main').scrollTop = 0; showStorage(); return; }
  if (!S.trip && !t.dataset.trip && !['importApply'].includes(t.id)) { if (!t.hasAttribute('data-close')) return; }
  if (t.dataset.trip) { await DB.kvSet('active', t.dataset.trip); await loadTrip(t.dataset.trip); S.view = 'today'; render(); return; }
  if (t.dataset.goview) { S.view = t.dataset.goview; render(); $('#main').scrollTop = 0; return; }
  if (t.dataset.goday !== undefined) { S.day = +t.dataset.goday; S.view = 'day'; S.sel = null; render(); $('#main').scrollTop = 0; return; }
  if (t.dataset.day !== undefined) { S.day = +t.dataset.day; S.sel = null; render(); return; }
  if (t.dataset.docf) { S.docFilter = t.dataset.docf; render(); return; }
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
    case 'fullBtn': S.full = !S.full; render(); break;
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
    case 'importApply': await applyImport(); break;
    case 'backupBtn': exportBackup(false); break;
    case 'backupFilesBtn': exportBackup(true); break;
    case 'deleteTrip': $('#dangerArea').innerHTML = '<div class="confirm"><span style="flex:1;min-width:150px;font-size:13.5px">Se borrarán el viaje, tus cambios y sus archivos de este iPhone. Exporta antes una copia si la quieres conservar.</span><button class="btn danger" id="delTripYes">Borrar</button><button class="btn" id="delTripNo">Cancelar</button></div>'; break;
    case 'delTripNo': render(); showStorage(); break;
    case 'delTripYes': {
      const id = S.trip.trip.id;
      for (const doc of S.trip.documents || []) for (const f of await DB.filesForDoc(doc.id)) await DB.fileDel(f.id);
      await DB.kvDel('trip:' + id); await DB.kvDel('base:' + id);
      S.trips = S.trips.filter(x => x.id !== id); await DB.kvSet('trips', S.trips);
      const next = S.trips[0]?.id || null; await DB.kvSet('active', next);
      S.trip = null; if (next) await loadTrip(next);
      S.view = S.trip ? 'today' : 'trips'; render(); toast('Viaje borrado del móvil'); break;
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
document.addEventListener('toggle', e => { if (e.target.matches?.('details.cl') && e.target.open) S.openCl = e.target.dataset.cl; }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.sheet) { S.sheet = null; renderLayer(); } else if (S.full) { S.full = false; render(); } }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-sel][role=button]')) { e.preventDefault(); e.target.click(); }
});
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
