// Modelo de datos, validación, fusión de importaciones y utilidades de tiempo.
// Funciones puras: se pueden probar con `node --test tests/`.

export const SCHEMA_VERSION = 1;

export const TYPES = { visit: 'Visita', hotel: 'Alojamiento', station: 'Estación', transport: 'Traslado', meal: 'Comida', task: 'Gestión' };
export const MODES = { walk: 'A pie', metro: 'Metro', train: 'Tren', shinkansen: 'Shinkansen', bus: 'Bus', taxi: 'Taxi', flight: 'Vuelo', boat: 'Barco', ropeway: 'Teleférico' };
export const TRANSIT = ['metro', 'train', 'shinkansen', 'bus', 'boat', 'ropeway'];
export const RES = { booked: ['Reservado', 'ok'], to_buy: ['Por comprar', 'crit'], check: ['Por confirmar', 'acc'], optional: ['Opcional', ''], none: ['Pago en taquilla', ''] };

/* ---------- Tiempo ---------- */
export const toMin = s => {
  if (!s || typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  return h > 23 || mm > 59 ? null : h * 60 + mm;
};
export const fmtMin = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

/** Duración legible si inicio y fin están en la misma zona; '' si no se puede calcular. */
export function duration(it, dayTz) {
  const a = toMin(it.start), b = toMin(it.end);
  if (a == null || b == null) return '';
  const tzA = it.tz || dayTz, tzB = it.endTz || tzA;
  if (tzA !== tzB) return '';
  let d = b - a + 1440 * (it.endDayOffset || 0);
  if (d < 0) d += 1440;
  const h = Math.floor(d / 60), m = d % 60;
  return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`;
}

/** Fecha (YYYY-MM-DD) y minutos del día actuales en una zona horaria IANA. */
export function nowIn(tz, date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const g = k => p.find(x => x.type === k).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, min: +g('hour') * 60 + +g('minute') };
}

/** Índice del día del viaje que es "hoy" según la zona de cada día, o -1. */
export function currentDayIndex(trip, date = new Date()) {
  return trip.days.findIndex(d => nowIn(d.tz, date).date === d.date);
}

/* ---------- Ahora / siguiente ---------- */
/** Calcula el elemento en curso, el siguiente y los posteriores para un día y minuto dados. */
export function dayStatus(day, nowMin) {
  const items = day.items;
  const timed = items.some(i => toMin(i.start) != null);
  let cur = null;
  if (timed && nowMin != null) {
    cur = items.find(it => {
      const a = toMin(it.start), b = toMin(it.end);
      return a != null && b != null && !it.endDayOffset && (it.tz || day.tz) === day.tz && a <= nowMin && nowMin < b && !it.done;
    }) || null;
  }
  const curIdx = cur ? items.indexOf(cur) : -1;
  const cand = it => !it.done && it.type !== 'transport' && it !== cur;
  let next = null;
  if (cur) next = items.find((it, i) => i > curIdx && cand(it)) || null;
  else if (timed && nowMin != null) {
    // primer elemento pendiente cuya hora no ha pasado; los elementos sin hora heredan la posición de la lista
    let lastTime = -1;
    for (const it of items) {
      const m = toMin(it.start);
      if (m != null) lastTime = m;
      if (cand(it) && (m != null ? m >= nowMin : lastTime >= nowMin)) { next = it; break; }
    }
  } else next = items.find(cand) || null;
  const nIdx = next ? items.indexOf(next) : -1;
  const leg = nIdx > 0 && items[nIdx - 1].type === 'transport' ? items[nIdx - 1] : null;
  const from = nIdx > 0 ? items.slice(0, nIdx).reverse().find(x => hasGeo(x)) || null : null;
  const later = nIdx > -1 ? items.slice(nIdx + 1).filter(i => i.type !== 'transport' && !i.done).slice(0, 3) : [];
  return { cur, next, leg, from, later };
}

export const hasGeo = it => !!(it && it.location && it.location.lat != null && it.location.lng != null);

/** Números de marcador según el orden actual (solo elementos con ubicación, sin traslados). */
export function markerOrder(day) {
  let n = 0; const map = {};
  for (const it of day.items) if (hasGeo(it) && it.type !== 'transport') map[it.id] = ++n;
  return map;
}

/** Avisos de cronología: horas fuera de orden y solapes (no reescribe nada). */
export function chronologyWarnings(day) {
  const w = {};
  let prev = null;
  for (const it of day.items) {
    const a = toMin(it.start);
    if (a == null || (it.tz && it.tz !== day.tz)) continue;
    if (prev) {
      const pa = toMin(prev.start), pb = toMin(prev.end);
      if (a < pa) w[it.id] = 'La hora no sigue el orden de la lista';
      else if (pb != null && !prev.endDayOffset && a < pb && prev.type !== 'transport' && it.type !== 'transport') w[it.id] = `Se solapa con «${prev.title}»`;
    }
    prev = it;
  }
  for (const it of day.items) {
    const a = toMin(it.start), b = toMin(it.end);
    if (a != null && b != null && !it.endDayOffset && !it.endTz && b < a && !w[it.id]) w[it.id] = 'La hora de fin es anterior a la de inicio';
  }
  return w;
}

/* ---------- Google Maps ---------- */
export function mapsSearchUrl(loc) {
  if (loc.mapsUrl) return loc.mapsUrl;
  const q = loc.address && loc.address !== loc.name ? `${loc.name}, ${loc.address}` : loc.name;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}
export function mapsDirUrl(from, to, mode) {
  const tm = mode === 'walk' ? 'walking' : TRANSIT.includes(mode) ? 'transit' : 'driving';
  const q = l => encodeURIComponent(l.address && l.address !== l.name ? `${l.name}, ${l.address}` : l.name);
  return `https://www.google.com/maps/dir/?api=1&origin=${q(from)}&destination=${q(to)}&travelmode=${tm}`;
}

/* ---------- Validación ---------- */
const isStr = v => typeof v === 'string' && v.length > 0;
/** Valida un dataset de viaje. Devuelve una lista de errores legibles (vacía si es válido). */
export function validateTrip(o) {
  const e = [];
  if (!o || typeof o !== 'object') return ['El archivo no contiene un objeto JSON.'];
  if (o.kind !== 'trip' && o.kind !== 'backup') e.push('Falta "kind": debe ser "trip" o "backup".');
  if (typeof o.schemaVersion !== 'number') e.push('Falta "schemaVersion".');
  else if (o.schemaVersion > SCHEMA_VERSION) e.push(`El archivo usa la versión ${o.schemaVersion} del formato y esta app solo entiende hasta la ${SCHEMA_VERSION}. Actualiza la app.`);
  const t = o.trip;
  if (!t || !isStr(t.id) || !isStr(t.name)) e.push('Falta "trip" con "id" y "name".');
  if (!Array.isArray(o.days) || !o.days.length) { e.push('Falta la lista "days".'); return e; }
  const ids = new Set();
  o.days.forEach((d, i) => {
    const where = `Día ${i + 1}`;
    if (!isStr(d.id)) e.push(`${where}: falta "id".`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) e.push(`${where}: fecha no válida (${d.date}).`);
    if (!isStr(d.tz)) e.push(`${where}: falta la zona horaria "tz".`);
    if (!Array.isArray(d.items)) { e.push(`${where}: falta "items".`); return; }
    d.items.forEach((it, j) => {
      const w = `${where}, elemento ${j + 1}`;
      if (!isStr(it.id)) e.push(`${w}: falta "id".`);
      else if (ids.has(it.id)) e.push(`${w}: id repetido "${it.id}".`);
      else ids.add(it.id);
      if (!TYPES[it.type]) e.push(`${w}: tipo desconocido "${it.type}".`);
      if (!isStr(it.title)) e.push(`${w}: falta el título.`);
      for (const k of ['start', 'end']) if (it[k] != null && it[k] !== '' && toMin(it[k]) == null) e.push(`${w}: hora "${k}" no válida (${it[k]}).`);
      if (it.location && it.location.lat != null && (Math.abs(it.location.lat) > 90 || Math.abs(it.location.lng) > 180)) e.push(`${w}: coordenadas fuera de rango.`);
    });
  });
  if (o.documents && !Array.isArray(o.documents)) e.push('"documents" debe ser una lista.');
  if (o.checklists && !Array.isArray(o.checklists)) e.push('"checklists" debe ser una lista.');
  return e;
}

/* ---------- Ediciones locales ---------- */
const EDITABLE = ['start', 'end', 'title'];
/** Aplica cambios a un elemento registrando qué campos se han modificado localmente. */
export function editItem(it, patch) {
  const local = { ...(it.local || {}) };
  local.fields = [...new Set([...(local.fields || []), ...Object.keys(patch).filter(k => EDITABLE.includes(k) && patch[k] !== it[k])])];
  local.at = new Date().toISOString();
  return { ...it, ...patch, local };
}

/* ---------- Fusión de importaciones ---------- */
/**
 * Fusiona un dataset importado (incoming) con la copia local (current), usando la base de la importación anterior (base)
 * para detectar conflictos. Conserva siempre: hecho/pendiente, notas personales, elementos añadidos localmente,
 * archivos de documentos y marcas de checklists. Nunca borra en silencio.
 * Devuelve { trip, summary, conflicts }.
 */
export function mergeImport(current, incoming, base) {
  const summary = { added: 0, updated: 0, kept: 0, localOnly: 0, missing: 0 };
  const conflicts = [];
  if (!current) {
    const t = structuredClone(incoming);
    summary.added = t.days.reduce((a, d) => a + d.items.length, 0);
    return { trip: t, summary, conflicts };
  }
  const curItems = new Map(), baseItems = new Map();
  current.days.forEach(d => d.items.forEach((it, i) => curItems.set(it.id, { it, day: d.id, i })));
  base?.days?.forEach(d => d.items.forEach(it => baseItems.set(it.id, it)));
  const incomingIds = new Set();
  const days = incoming.days.map(nd => {
    const cd = current.days.find(d => d.id === nd.id);
    const items = nd.items.map(ni => {
      incomingIds.add(ni.id);
      const c = curItems.get(ni.id);
      if (!c) { summary.added++; return structuredClone(ni); }
      const ci = c.it, bi = baseItems.get(ni.id);
      const merged = { ...structuredClone(ni), done: ci.done, userNote: ci.userNote };
      if (ci.local?.fields?.length) {
        for (const f of ci.local.fields) {
          const changedUpstream = bi ? JSON.stringify(bi[f]) !== JSON.stringify(ni[f]) : JSON.stringify(ci[f]) !== JSON.stringify(ni[f]);
          if (changedUpstream && JSON.stringify(ci[f]) !== JSON.stringify(ni[f])) conflicts.push({ itemId: ni.id, day: nd.id, title: ni.title, field: f, local: ci[f], incoming: ni[f] });
          merged[f] = ci[f]; // se mantiene lo local hasta que el usuario decida
        }
        merged.local = ci.local;
        summary.kept++;
      } else if (JSON.stringify({ ...ni, done: 0, userNote: 0 }) !== JSON.stringify({ ...ci, done: 0, userNote: 0, local: undefined })) summary.updated++;
      return merged;
    });
    // elementos locales de este día que no vienen en la importación
    if (cd) cd.items.forEach((ci, idx) => {
      if (incomingIds.has(ci.id)) return;
      if (ci.userAdded) { summary.localOnly++; items.splice(Math.min(idx, items.length), 0, ci); }
      else if (!incoming.days.some(d => d.items.some(x => x.id === ci.id))) { summary.missing++; items.splice(Math.min(idx, items.length), 0, { ...ci, missingFromSource: true }); }
    });
    return { ...structuredClone(nd), items };
  });
  // estados de checklists
  const doneMap = new Map();
  current.checklists?.forEach(c => c.sections.forEach(s => s.items.forEach(i => doneMap.set(i.id, i.done))));
  const checklists = (incoming.checklists || []).map(c => ({ ...c, sections: c.sections.map(s => ({ ...s, items: s.items.map(i => ({ ...i, done: doneMap.get(i.id) ?? i.done })) })) }));
  current.checklists?.filter(c => c.userAdded && !checklists.some(x => x.id === c.id)).forEach(c => checklists.push(c));
  // documentos: conservar archivos adjuntos y estado listo
  const curDocs = new Map((current.documents || []).map(d => [d.id, d]));
  const documents = (incoming.documents || []).map(d => {
    const c = curDocs.get(d.id);
    return c ? { ...d, files: c.files || [], status: c.files?.length ? 'available' : d.status } : d;
  });
  (current.documents || []).filter(d => !documents.some(x => x.id === d.id) && (d.userAdded || d.files?.length)).forEach(d => documents.push(d));
  const trip = { ...structuredClone(incoming), days, checklists, documents };
  return { trip, summary, conflicts };
}

/** Resumen corto del contenido de un viaje. */
export function tripCounts(t) {
  return {
    days: t.days.length,
    items: t.days.reduce((a, d) => a + d.items.length, 0),
    done: t.days.reduce((a, d) => a + d.items.filter(i => i.done).length, 0),
    docs: (t.documents || []).length,
    lists: (t.checklists || []).length,
  };
}
