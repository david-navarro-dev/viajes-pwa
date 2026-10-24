// Mapa del día con Leaflet. Si las teselas no cargan (sin conexión), los marcadores siguen visibles.
import { hasGeo, markerOrder, TRANSIT, fmtMin, toMin } from './model.js';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>';

/** Curva suave entre dos puntos (para que no parezca una ruta real). */
function arc(a, b) {
  const pts = [], [la1, lo1] = a, [la2, lo2] = b;
  const dx = lo2 - lo1, dy = la2 - la1, off = 0.15;
  const cx = (lo1 + lo2) / 2 - dy * off, cy = (la1 + la2) / 2 + dx * off;
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const x = (1 - t) ** 2 * lo1 + 2 * (1 - t) * t * cx + t * t * lo2;
    const y = (1 - t) ** 2 * la1 + 2 * (1 - t) * t * cy + t * t * la2;
    pts.push([y, x]);
  }
  return pts;
}

export class DayMap {
  constructor(el, { onSelect }) {
    this.el = el; this.onSelect = onSelect;
    this.map = L.map(el, { zoomControl: false, attributionControl: true, tap: true });
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.tiles = L.tileLayer(TILE_URL, { attribution: ATTR, subdomains: 'abcd', maxZoom: 19, detectRetina: true }).addTo(this.map);
    this.tileErrors = 0;
    this.tiles.on('tileerror', () => { this.tileErrors++; el.classList.toggle('tiles-failed', this.tileErrors > 3); });
    this.tiles.on('tileload', () => { if (this.tileErrors) { this.tileErrors = 0; el.classList.remove('tiles-failed'); } });
    this.layer = L.layerGroup().addTo(this.map);
    this.lines = L.layerGroup().addTo(this.map);
    this.markers = {};
  }

  render(day, selId, { fit = true } = {}) {
    this.layer.clearLayers(); this.lines.clearLayers(); this.markers = {};
    const order = markerOrder(day);
    const pts = day.items.filter(i => order[i.id]);
    // líneas de orden entre paradas consecutivas
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const between = day.items.slice(day.items.indexOf(a) + 1, day.items.indexOf(b)).filter(x => x.type === 'transport');
      const mode = between.length ? between[between.length - 1].mode : null;
      const sel = selId && (selId === b.id || between.some(x => x.id === selId));
      let style = { color: '#5B636D', weight: 2, dashArray: '2 6', opacity: 0.9 };
      if (mode === 'walk') style = { color: '#A3ABB5', weight: 2.5, dashArray: '6 6' };
      else if (TRANSIT.includes(mode)) style = { color: '#7FA8E6', weight: 3, dashArray: null };
      else if (mode === 'flight') style = { color: '#7FA8E6', weight: 2, dashArray: '1 7' };
      else if (mode === 'taxi') style = { color: '#A3ABB5', weight: 2.5, dashArray: null };
      if (sel) style = { ...style, color: '#F3B755', weight: style.weight + 1.5, opacity: 1 };
      L.polyline(arc([a.location.lat, a.location.lng], [b.location.lat, b.location.lng]), { ...style, interactive: false, lineCap: 'round' }).addTo(this.lines);
    }
    // marcadores (los iguales se separan un poco)
    const seen = [];
    for (const it of pts) {
      let lat = it.location.lat, lng = it.location.lng, k = 0;
      while (seen.some(([a, b]) => Math.abs(a - lat) < 0.00025 && Math.abs(b - lng) < 0.00025) && k < 8) { lat += 0.00028 * Math.cos(k); lng += 0.00034 * Math.sin(k); k++; }
      seen.push([lat, lng]);
      const sel = it.id === selId;
      const n = order[it.id];
      const cls = ['mk', 'mk-' + it.type, sel ? 'sel' : '', it.done ? 'done' : ''].join(' ');
      const label = sel && it.start ? `<span class="mk-time">${it.start}</span>` : '';
      const icon = L.divIcon({ className: '', html: `<div class="${cls}"><span>${n}</span>${label}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
      const m = L.marker([lat, lng], { icon, keyboard: true, title: `${n}. ${it.title}`, zIndexOffset: sel ? 1000 : 0, riseOnHover: true });
      m.on('click', () => this.onSelect(it.id, true));
      m.addTo(this.layer);
      this.markers[it.id] = m;
    }
    if (fit && pts.length) this.fit(pts);
    return pts.length;
  }

  fit(pts) {
    const b = L.latLngBounds(pts.map(p => [p.location.lat, p.location.lng]));
    if (pts.length === 1) this.map.setView(b.getCenter(), 15);
    else this.map.fitBounds(b, { padding: [36, 36], maxZoom: 16 });
  }

  focus(id) {
    const m = this.markers[id];
    if (m && !this.map.getBounds().pad(-0.1).contains(m.getLatLng())) this.map.panTo(m.getLatLng());
  }

  invalidate() { setTimeout(() => this.map.invalidateSize(), 60); }
  destroy() { this.map.remove(); }
}
