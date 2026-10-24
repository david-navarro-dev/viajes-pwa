// Mapa del día con MapLibre + OpenFreeMap (gratuito, sin clave).
// Si MapLibre o WebGL no están disponibles, se usa un mapa esquemático en SVG: la agenda nunca se bloquea.
import { markerOrder, TRANSIT } from './model.js';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
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
    const kind = mode === 'walk' ? 'walk' : TRANSIT.includes(mode) ? 'transit' : mode === 'flight' ? 'flight' : mode === 'taxi' ? 'taxi' : 'none';
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
        container: el, style: STYLE_URL, attributionControl: { compact: true },
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
      this.map.addLayer({ ...base, id: 'order-walk', filter: ['==', ['get', 'kind'], 'walk'], paint: { 'line-color': ['case', ['get', 'sel'], '#F3B755', '#B4BCC6'], 'line-width': ['case', ['get', 'sel'], 4, 2.5], 'line-dasharray': [1.5, 1.5] } });
      this.map.addLayer({ ...base, id: 'order-transit', filter: ['==', ['get', 'kind'], 'transit'], paint: { 'line-color': ['case', ['get', 'sel'], '#F3B755', '#7FA8E6'], 'line-width': ['case', ['get', 'sel'], 4.5, 3] } });
      this.map.addLayer({ ...base, id: 'order-flight', filter: ['==', ['get', 'kind'], 'flight'], paint: { 'line-color': ['case', ['get', 'sel'], '#F3B755', '#7FA8E6'], 'line-width': 2, 'line-dasharray': [0.5, 2.5] } });
      this.map.addLayer({ ...base, id: 'order-taxi', filter: ['==', ['get', 'kind'], 'taxi'], paint: { 'line-color': ['case', ['get', 'sel'], '#F3B755', '#B4BCC6'], 'line-width': ['case', ['get', 'sel'], 4, 2.5] } });
      this.map.addLayer({ ...base, id: 'order-none', filter: ['==', ['get', 'kind'], 'none'], paint: { 'line-color': ['case', ['get', 'sel'], '#F3B755', '#6B747E'], 'line-width': 2, 'line-dasharray': [0.5, 2] } });
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
    const col = { walk: '#B4BCC6', transit: '#7FA8E6', flight: '#7FA8E6', taxi: '#B4BCC6', none: '#6B747E' };
    const dash = { walk: '5 5', transit: '', flight: '1 6', taxi: '', none: '2 5' };
    const lines = g.segs.map(s => `<polyline fill="none" stroke="${s.sel ? '#F3B755' : col[s.kind]}" stroke-width="${s.sel ? 4 : 2.5}" stroke-dasharray="${dash[s.kind]}" stroke-linecap="round" points="${arc(s.from, s.to).map(P).map(p => p.join(',')).join(' ')}"/>`).join('');
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
export function tilesForTrip(trip, template, { minZ = 10, maxZ = 14, pad = 0.01 } = {}) {
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

/** Descarga estilo, recursos y teselas del viaje; el service worker los guarda. */
export async function prefetchTrip(trip, onProgress, signal) {
  const style = await (await fetch(STYLE_URL, { signal })).json();
  const tj = await (await fetch(style.sources.openmaptiles.url, { signal })).json();
  const extra = [`${style.sprite}.json`, `${style.sprite}.png`, `${style.sprite}@2x.json`, `${style.sprite}@2x.png`,
    ...['0-255', '256-511', '8192-8447'].map(r => style.glyphs.replace('{fontstack}', encodeURIComponent('Noto Sans Regular')).replace('{range}', r))];
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
