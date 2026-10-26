// Mapas con MapLibre + OpenFreeMap (gratuito, sin clave): mapa del día y mapa del viaje.
// Si MapLibre o WebGL no están disponibles, se usa un mapa esquemático en SVG: la agenda nunca se bloquea.
import { markerOrder, TRANSIT } from './model.js';

// Estilos de OpenFreeMap (datos de OpenStreetMap). Se elige en Ajustes y se recuerda en este dispositivo.
export const MAP_STYLES = {
  liberty: { label: 'Claro', url: 'https://tiles.openfreemap.org/styles/liberty', light: true },
  positron: { label: 'Claro sencillo', url: 'https://tiles.openfreemap.org/styles/positron', light: true },
  dark: { label: 'Oscuro', url: 'https://tiles.openfreemap.org/styles/dark', light: false },
};
let styleKey = 'liberty';
try { const k = localStorage.getItem('tf-map'); if (MAP_STYLES[k]) styleKey = k; } catch {}
export const getMapStyle = () => styleKey;
export function setMapStyle(k) { if (!MAP_STYLES[k]) return; styleKey = k; try { localStorage.setItem('tf-map', k); } catch {} }
export const mapIsLight = () => MAP_STYLES[styleKey].light;
const styleUrl = () => MAP_STYLES[styleKey].url;
/** Colores de las líneas del mapa del día según el estilo (claro u oscuro). */
export const lineColors = () => mapIsLight()
  ? { walk: '#4A525C', transit: '#2F64C8', flight: '#2F64C8', taxi: '#4A525C', none: '#8A929C', sel: '#E8662E', casing: '#FFFFFF' }
  : { walk: '#B4BCC6', transit: '#7FA8E6', flight: '#7FA8E6', taxi: '#B4BCC6', none: '#6B747E', sel: '#FF8A4C', casing: '#121012' };
const LABEL = ['coalesce', ['get', 'name:latin'], ['get', 'name_en'], ['get', 'name']];

/** Curva suave entre dos puntos [lng,lat] para que no parezca una ruta real. */
function arc(a, b) {
  const pts = [], [x1, y1] = a, [x2, y2] = b, off = 0.15;
  const cx = (x1 + x2) / 2 - (y2 - y1) * off, cy = (y1 + y2) / 2 + (x2 - x1) * off;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([(1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2]);
  }
  return pts;
}

/** Puntos y segmentos del día en orden, con los marcadores iguales ligeramente separados. */
function geometry(day, selId) {
  const order = markerOrder(day);
  const pts = day.items.filter(i => order[i.id]);
  const seen = [];
  const pos = {};
  for (const it of pts) {
    let lat = it.location.lat, lng = it.location.lng, k = 0;
    while (seen.some(([a, b]) => Math.abs(a - lat) < 0.00025 && Math.abs(b - lng) < 0.00025) && k < 8) { lat += 0.00028 * Math.cos(k); lng += 0.00034 * Math.sin(k); k++; }
    seen.push([lat, lng]); pos[it.id] = [lng, lat];
  }
  const segs = [];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    const between = day.items.slice(day.items.indexOf(a) + 1, day.items.indexOf(b)).filter(x => x.type === 'transport');
    const mode = between.length ? between[between.length - 1].mode : null;
    const kind = mode === 'walk' ? 'walk' : TRANSIT.includes(mode) ? 'transit' : mode === 'flight' ? 'flight' : mode === 'taxi' || mode === 'car' ? 'taxi' : 'none';
    const sel = !!selId && (selId === b.id || between.some(x => x.id === selId));
    segs.push({ from: pos[a.id], to: pos[b.id], kind, sel });
  }
  return { order, pts, pos, segs };
}

function markerEl(it, n, selId) {
  const el = document.createElement('div');
  el.className = ['mk', 'mk-' + it.type, it.id === selId ? 'sel' : '', it.done ? 'done' : ''].join(' ');
  el.innerHTML = `<span>${n}</span>${it.id === selId && it.start ? `<span class="mk-time">${it.start}</span>` : ''}`;
  el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', `${n}. ${it.title}`);
  return el;
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export class DayMap {
  constructor(el, { onSelect, onStatus }) {
    this.el = el; this.onSelect = onSelect; this.onStatus = onStatus || (() => {});
    this.markers = []; this.pending = null; this.loaded = false; this.fallback = false;
    if (typeof maplibregl === 'undefined' || !webglOk()) { this.fallback = true; return; }
    try {
      this.map = new maplibregl.Map({
        container: el, style: styleUrl(), attributionControl: { compact: true },
        center: [139.77, 35.68], zoom: 11, maxZoom: 18, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        cooperativeGestures: false, fadeDuration: 0,
      });
    } catch { this.fallback = true; return; }
    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    this.map.on('load', () => {
      for (const l of this.map.getStyle().layers) if (l.layout && l.layout['text-field'] && l.id !== 'highway_shield' && !String(l.id).includes('shield')) {
        try { this.map.setLayoutProperty(l.id, 'text-field', LABEL); } catch {}
      }
      this.map.addSource('order', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      const base = { type: 'line', source: 'order', layout: { 'line-cap': 'round', 'line-join': 'round' } };
      const C = lineColors(), col = k => ['case', ['get', 'sel'], C.sel, C[k]];
      this.map.addLayer({ ...base, id: 'order-casing', filter: ['!=', ['get', 'kind'], 'flight'], paint: { 'line-color': C.casing, 'line-width': ['case', ['get', 'sel'], 7, 5], 'line-opacity': 0.75 } });
      this.map.addLayer({ ...base, id: 'order-walk', filter: ['==', ['get', 'kind'], 'walk'], paint: { 'line-color': col('walk'), 'line-width': ['case', ['get', 'sel'], 4, 2.5], 'line-dasharray': [1.5, 1.5] } });
      this.map.addLayer({ ...base, id: 'order-transit', filter: ['==', ['get', 'kind'], 'transit'], paint: { 'line-color': col('transit'), 'line-width': ['case', ['get', 'sel'], 4.5, 3] } });
      this.map.addLayer({ ...base, id: 'order-flight', filter: ['==', ['get', 'kind'], 'flight'], paint: { 'line-color': col('flight'), 'line-width': 2, 'line-dasharray': [0.5, 2.5] } });
      this.map.addLayer({ ...base, id: 'order-taxi', filter: ['==', ['get', 'kind'], 'taxi'], paint: { 'line-color': col('taxi'), 'line-width': ['case', ['get', 'sel'], 4, 2.5] } });
      this.map.addLayer({ ...base, id: 'order-none', filter: ['==', ['get', 'kind'], 'none'], paint: { 'line-color': col('none'), 'line-width': 2, 'line-dasharray': [0.5, 2] } });
      this.loaded = true;
      this.onStatus('ok');
      if (this.pending) { const p = this.pending; this.pending = null; this.render(...p); }
    });
    this.map.on('error', e => {
      const msg = String(e?.error?.message || e?.error || '');
      if (!this.loaded) this.onStatus('nostyle'); else if (/fetch|network|load/i.test(msg)) this.onStatus('tiles');
    });
  }

  render(day, selId, { fit = true } = {}) {
    const g = geometry(day, selId);
    if (this.fallback) { this.renderSvg(day, selId, g); return g.pts.length; }
    // los marcadores son DOM: se dibujan aunque el estilo no haya cargado
    this.markers.forEach(m => m.remove()); this.markers = [];
    for (const it of g.pts) {
      const el = markerEl(it, g.order[it.id], selId);
      el.addEventListener('click', ev => { ev.stopPropagation(); this.onSelect(it.id, true); });
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter') this.onSelect(it.id, true); });
      this.markers.push(new maplibregl.Marker({ element: el }).setLngLat(g.pos[it.id]).addTo(this.map));
    }
    if (fit && g.pts.length) this.fit(g.pts.map(it => g.pos[it.id]));
    if (!this.loaded) { this.pending = [day, selId, { fit: false }]; return g.pts.length; }
    this.map.getSource('order').setData({ type: 'FeatureCollection', features: g.segs.map(s => ({ type: 'Feature', properties: { kind: s.kind, sel: s.sel }, geometry: { type: 'LineString', coordinates: arc(s.from, s.to) } })) });
    return g.pts.length;
  }

  fit(coords) {
    if (this.fallback || !coords.length) return;
    if (coords.length === 1) { this.map.jumpTo({ center: coords[0], zoom: 15 }); return; }
    const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    this.map.fitBounds(b, { padding: { top: 56, bottom: 40, left: 36, right: 64 }, maxZoom: 16, duration: 0 });
  }

  fitDay(day) { const g = geometry(day, null); if (this.fallback) return; this.fit(g.pts.map(it => g.pos[it.id])); }

  focus(day, id) {
    if (this.fallback) return;
    const g = geometry(day, id), p = g.pos[id];
    if (!p) return;
    const pt = this.map.project(p), c = this.map.getContainer();
    if (pt.x < 30 || pt.y < 30 || pt.x > c.clientWidth - 30 || pt.y > c.clientHeight - 30) this.map.easeTo({ center: p, duration: 300 });
  }

  resize() { if (!this.fallback) setTimeout(() => this.map.resize(), 50); }

  /** Mapa esquemático (sin teselas) para cuando no hay WebGL o MapLibre. */
  renderSvg(day, selId, g) {
    const W = this.el.clientWidth || 360, H = this.el.clientHeight || 240;
    if (!g.pts.length) { this.el.innerHTML = ''; return; }
    const ll = g.pts.map(it => g.pos[it.id]);
    const lngs = ll.map(p => p[0]), lats = ll.map(p => p[1]);
    const k = Math.cos((Math.min(...lats) + Math.max(...lats)) / 2 * Math.PI / 180);
    const dx = Math.max((Math.max(...lngs) - Math.min(...lngs)) * k, 0.004), dy = Math.max(Math.max(...lats) - Math.min(...lats), 0.004);
    const sc = Math.min((W - 80) / dx, (H - 80) / dy), cx = (Math.max(...lngs) + Math.min(...lngs)) / 2, cy = (Math.max(...lats) + Math.min(...lats)) / 2;
    const P = ([x, y]) => [W / 2 + (x - cx) * k * sc, H / 2 - (y - cy) * sc];
    const col = lineColors();
    const dash = { walk: '5 5', transit: '', flight: '1 6', taxi: '', none: '2 5' };
    const lines = g.segs.map(s => `<polyline fill="none" stroke="${s.sel ? col.sel : col[s.kind]}" stroke-width="${s.sel ? 4 : 2.5}" stroke-dasharray="${dash[s.kind]}" stroke-linecap="round" points="${arc(s.from, s.to).map(P).map(p => p.join(',')).join(' ')}"/>`).join('');
    this.el.innerHTML = `<svg width="${W}" height="${H}" style="position:absolute;inset:0">${lines}</svg><div class="svg-note">Mapa esquemático: el mapa base no está disponible en este dispositivo</div>`;
    for (const it of g.pts) {
      const [x, y] = P(g.pos[it.id]);
      const el = markerEl(it, g.order[it.id], selId);
      el.style.position = 'absolute'; el.style.left = (x - 15) + 'px'; el.style.top = (y - 15) + 'px';
      el.addEventListener('click', () => this.onSelect(it.id, true));
      this.el.appendChild(el);
    }
  }
}

/* ---------- Mapas sin conexión ---------- */
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };

/** Lista de teselas a guardar para todos los días con ubicaciones (zoom 10–14, con margen). */
export function tilesForTrip(trip, template, { minZ = 10, maxZ = 14, pad = 0.02 } = {}) {
  const set = new Set();
  for (const day of trip.days) {
    const pts = day.items.filter(i => i.location?.lat != null);
    if (day.lodging?.lat != null) pts.push({ location: day.lodging });
    // agrupa puntos cercanos para no descargar todo el espacio entre ciudades
    const clusters = [];
    for (const p of pts) {
      const c = clusters.find(c => Math.abs(c.lat - p.location.lat) < 0.15 && Math.abs(c.lng - p.location.lng) < 0.2);
      if (c) c.items.push(p.location); else clusters.push({ lat: p.location.lat, lng: p.location.lng, items: [p.location] });
    }
    for (const c of clusters) {
      const lats = c.items.map(l => l.lat), lngs = c.items.map(l => l.lng);
      const [s, n, w, e] = [Math.min(...lats) - pad, Math.max(...lats) + pad, Math.min(...lngs) - pad, Math.max(...lngs) + pad];
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = lon2x(w, z); x <= lon2x(e, z); x++) for (let y = lat2y(n, z); y <= lat2y(s, z); y++) set.add(template.replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }
  return [...set];
}

/** Fuentes que usa un estilo (para descargar sus glifos sin conexión). */
function styleFonts(style) {
  const set = new Set();
  for (const l of style.layers || []) { const f = l.layout?.['text-font']; if (Array.isArray(f) && f.every(x => typeof x === 'string')) set.add(f.join(',')); }
  return set.size ? [...set] : ['Noto Sans Regular'];
}

/** Descarga estilo, recursos y teselas del viaje; el service worker los guarda. */
export async function prefetchTrip(trip, onProgress, signal) {
  const style = await (await fetch(styleUrl(), { signal })).json();
  const tj = await (await fetch(style.sources.openmaptiles.url, { signal })).json();
  const extra = [`${style.sprite}.json`, `${style.sprite}.png`, `${style.sprite}@2x.json`, `${style.sprite}@2x.png`,
    ...styleFonts(style).flatMap(f => ['0-255', '256-511', '8192-8447'].map(r => style.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', r)))];
  const tiles = tilesForTrip(trip, tj.tiles[0]);
  const all = [...extra, ...tiles];
  let done = 0, failed = 0, bytes = 0;
  const queue = all.slice();
  const worker = async () => {
    while (queue.length) {
      if (signal?.aborted) return;
      const u = queue.shift();
      try { const r = await fetch(u, { signal }); if (r.ok) bytes += (await r.arrayBuffer()).byteLength; else failed++; } catch { if (signal?.aborted) return; failed++; }
      done++; onProgress?.({ done, total: all.length, failed, bytes });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { total: all.length, failed, bytes };
}

/* ---------- Mapa del viaje: rutas de todos los días ---------- */
export const DAY_COLORS = ['#FF8A4C', '#5CC6B8', '#B9A2F2', '#7FA8E6', '#FFC24F', '#F06FA8', '#6CC48A', '#E8A37C'];
// En mapas claros, tonos más intensos para que las rutas destaquen sobre el fondo.
export const DAY_COLORS_LIGHT = ['#E8662E', '#14917F', '#7650D8', '#2F64C8', '#C28400', '#D6337F', '#25904F', '#B05A30'];
export const dayColor = i => (mapIsLight() ? DAY_COLORS_LIGHT : DAY_COLORS)[i % DAY_COLORS.length];
const FAR_KM = 1500; // tramos más largos (vuelos intercontinentales) no se dibujan

function kmBetween([x1, y1], [x2, y2]) {
  const r = v => v * Math.PI / 180, dLat = r(y2 - y1), dLng = r(x2 - x1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(y1)) * Math.cos(r(y2)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Geometría de todos los días: una línea por día (tramos en curva) y sus puntos. */
export function tripGeometry(trip) {
  const geo = trip.days.map((d, i) => {
    const pts = d.items.filter(it => it.type !== 'transport' && it.location?.lat != null).map(it => [it.location.lng, it.location.lat]);
    const lines = []; let cur = [];
    for (let k = 1; k < pts.length; k++) {
      if (pts[k][0] === pts[k - 1][0] && pts[k][1] === pts[k - 1][1]) continue;
      if (kmBetween(pts[k - 1], pts[k]) > FAR_KM) { if (cur.length) lines.push(cur); cur = []; continue; }
      const a = arc(pts[k - 1], pts[k]); cur.push(...(cur.length ? a.slice(1) : a));
    }
    if (cur.length) lines.push(cur);
    const main = lines.slice().sort((a, b) => b.length - a.length)[0];
    return { i, n: d.n, color: dayColor(i), pts, lines, main, mid: null, home: d.tz === trip.trip.tz };
  });
  // Número de día sobre su ruta, buscando un punto que no choque con los de otros días.
  const placed = [], FR = [0.5, 0.35, 0.65, 0.22, 0.78, 0.12, 0.88, 0.05, 0.95];
  for (const g of geo) {
    if (!g.main) { g.mid = g.pts[0] || null; continue; }
    let best = null, bestD = -1;
    for (const f of FR) {
      const c = g.main[Math.min(g.main.length - 1, Math.round(f * (g.main.length - 1)))];
      const dmin = placed.length ? Math.min(...placed.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))) : Infinity;
      if (dmin > 0.006) { best = c; break; }
      if (dmin > bestD) { bestD = dmin; best = c; }
    }
    g.mid = best; placed.push(best);
  }
  return geo;
}

export class TripMap {
  constructor(el, { onSelect, onStatus }) {
    this.el = el; this.onSelect = onSelect; this.onStatus = onStatus || (() => {});
    this.badges = []; this.loaded = false; this.pending = null; this.fallback = false;
    if (typeof maplibregl === 'undefined' || !webglOk()) { this.fallback = true; return; }
    try {
      this.map = new maplibregl.Map({
        container: el, style: styleUrl(), attributionControl: { compact: true }, center: [137, 36], zoom: 5, maxZoom: 17,
        dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0,
      });
    } catch { this.fallback = true; return; }
    this.map.touchZoomRotate.disableRotation();
    this.map.on('load', () => {
      for (const l of this.map.getStyle().layers) if (l.layout && l.layout['text-field'] && !String(l.id).includes('shield')) {
        try { this.map.setLayoutProperty(l.id, 'text-field', LABEL); } catch {}
      }
      const fc = { type: 'FeatureCollection', features: [] };
      this.map.addSource('trip-l', { type: 'geojson', data: fc });
      this.map.addSource('trip-p', { type: 'geojson', data: fc });
      const lay = { 'line-cap': 'round', 'line-join': 'round' };
      const op = ['case', ['get', 'dim'], 0.22, 0.95];
      this.map.addLayer({ id: 'trip-casing', type: 'line', source: 'trip-l', layout: lay, paint: { 'line-color': lineColors().casing, 'line-width': ['case', ['get', 'sel'], 8, 5.5], 'line-opacity': ['case', ['get', 'dim'], 0, 0.85] } });
      this.map.addLayer({ id: 'trip-line', type: 'line', source: 'trip-l', layout: lay, paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'sel'], 5, 3], 'line-opacity': op } });
      this.map.addLayer({ id: 'trip-pt', type: 'circle', source: 'trip-p', paint: { 'circle-radius': ['case', ['get', 'sel'], 5, 3.5], 'circle-color': ['get', 'color'], 'circle-stroke-color': lineColors().casing, 'circle-stroke-width': 1.5, 'circle-opacity': op, 'circle-stroke-opacity': op } });
      this.map.addLayer({ id: 'trip-hit', type: 'line', source: 'trip-l', layout: lay, paint: { 'line-color': '#000', 'line-width': 22, 'line-opacity': 0.01 } });
      this.map.on('click', e => {
        const f = this.map.queryRenderedFeatures(e.point, { layers: ['trip-hit', 'trip-pt'] })[0];
        this.onSelect(f ? +f.properties.day : null);
      });
      this.map.on('mouseenter', 'trip-hit', () => { this.map.getCanvas().style.cursor = 'pointer'; });
      this.map.on('mouseleave', 'trip-hit', () => { this.map.getCanvas().style.cursor = ''; });
      this.loaded = true; this.onStatus('ok');
      if (this.pending) { const p = this.pending; this.pending = null; this.render(...p); }
    });
    // Sin estilo (sin conexión y sin copia): se pasa al mapa esquemático para que las rutas se vean igual.
    this.map.on('error', () => {
      if (this.loaded || this.fallback) return;
      this.onStatus('ok'); // el esquema ya lleva su propio aviso
      this.badges.forEach(m => m.remove()); this.badges = [];
      try { this.map.remove(); } catch {}
      this.map = null; this.fallback = true; this.el.innerHTML = '';
      if (this.g) this.renderSvg(this.sel);
    });
  }

  render(trip, sel, { fit = false } = {}) {
    this.g = tripGeometry(trip); this.sel = sel;
    if (this.fallback) { this.renderSvg(sel); return; }
    this.badges.forEach(m => m.remove()); this.badges = [];
    for (const d of this.g) if (d.mid && d.lines.length) {
      const el = document.createElement('button');
      el.className = 'tm-badge' + (sel === d.i ? ' sel' : '') + (sel != null && sel !== d.i ? ' dim' : '');
      el.style.setProperty('--c', d.color); el.textContent = d.n; el.setAttribute('aria-label', `Día ${d.n}`);
      el.addEventListener('click', ev => { ev.stopPropagation(); this.onSelect(d.i); });
      this.badges.push(new maplibregl.Marker({ element: el }).setLngLat(d.mid).addTo(this.map));
    }
    if (fit) sel != null ? this.fitDay(sel) : this.fitAll();
    if (!this.loaded) { this.pending = [trip, sel, { fit: false }]; return; }
    const lines = [], pts = [];
    for (const d of this.g) {
      const p = { day: d.i, color: d.color, sel: sel === d.i, dim: sel != null && sel !== d.i };
      d.lines.forEach(c => lines.push({ type: 'Feature', properties: p, geometry: { type: 'LineString', coordinates: c } }));
      d.pts.forEach(c => pts.push({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: c } }));
    }
    // el día elegido se dibuja encima
    const top = f => (f.properties.sel ? 1 : 0);
    lines.sort((a, b) => top(a) - top(b)); pts.sort((a, b) => top(a) - top(b));
    this.map.getSource('trip-l').setData({ type: 'FeatureCollection', features: lines });
    this.map.getSource('trip-p').setData({ type: 'FeatureCollection', features: pts });
  }

  _fit(coords, pad) {
    if (this.fallback || !coords.length) return;
    if (coords.length === 1) { this.map.easeTo({ center: coords[0], zoom: 14, duration: 400 }); return; }
    const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    this.map.fitBounds(b, { padding: pad || { top: 70, bottom: 60, left: 40, right: 40 }, maxZoom: 15, duration: 400 });
  }
  fitAll() { const home = this.g.filter(d => d.home); this._fit((home.length ? home : this.g).flatMap(d => d.pts)); }
  fitDay(i, pad) { const d = this.g?.[i]; if (d) this._fit(d.pts, pad); }
  resize() { if (!this.fallback) setTimeout(() => this.map.resize(), 50); }

  renderSvg(sel) {
    const W = this.el.clientWidth || 360, H = this.el.clientHeight || 400;
    const all = this.g.filter(d => d.home).flatMap(d => d.pts);
    if (!all.length) { this.el.innerHTML = ''; return; }
    const lngs = all.map(p => p[0]), lats = all.map(p => p[1]);
    const k = Math.cos((Math.min(...lats) + Math.max(...lats)) / 2 * Math.PI / 180);
    const sc = Math.min((W - 60) / Math.max((Math.max(...lngs) - Math.min(...lngs)) * k, 0.01), (H - 60) / Math.max(Math.max(...lats) - Math.min(...lats), 0.01));
    const cx = (Math.max(...lngs) + Math.min(...lngs)) / 2, cy = (Math.max(...lats) + Math.min(...lats)) / 2;
    const P = ([x, y]) => `${(W / 2 + (x - cx) * k * sc).toFixed(1)},${(H / 2 - (y - cy) * sc).toFixed(1)}`;
    const svg = this.g.map(d => d.lines.map(c => `<polyline data-tday="${d.i}" fill="none" stroke="${d.color}" stroke-opacity="${sel != null && sel !== d.i ? 0.25 : 1}" stroke-width="${sel === d.i ? 5 : 3}" stroke-linecap="round" stroke-linejoin="round" points="${c.map(P).join(' ')}"/>`).join('')).join('');
    const badges = this.g.filter(d => d.home && d.mid && d.lines.length).map(d => { const [x, y] = P(d.mid).split(','); return `<g data-tday="${d.i}" opacity="${sel != null && sel !== d.i ? 0.35 : 1}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${sel === d.i ? 14 : 11}" fill="${d.color}" stroke="#121012" stroke-width="2"/><text x="${x}" y="${(+y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="#121012">${d.n}</text></g>`; }).join('');
    this.el.innerHTML = `<svg width="${W}" height="${H}" style="position:absolute;inset:0">${svg}${badges}</svg><div class="svg-note">Mapa esquemático: el mapa base no está disponible ahora</div>`;
    this.el.querySelectorAll('[data-tday]').forEach(l => l.addEventListener('click', () => this.onSelect(+l.dataset.tday)));
  }
}
