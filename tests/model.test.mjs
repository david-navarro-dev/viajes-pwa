import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as M from '../src/model.js';

const mini = () => ({
  schemaVersion: 1, kind: 'trip', trip: { id: 't1', name: 'Prueba', tz: 'Asia/Tokyo', startDate: '2026-10-30', endDate: '2026-10-30' },
  days: [{ id: 'd01', n: 1, date: '2026-10-30', tz: 'Asia/Tokyo', items: [
    { id: 'a', type: 'visit', title: 'A', start: '09:00', end: '10:00', location: { name: 'A', lat: 35, lng: 139 } },
    { id: 'w', type: 'transport', mode: 'walk', title: 'A pie', start: '10:00', end: '10:15' },
    { id: 'b', type: 'visit', title: 'B', start: '10:15', end: '11:00', location: { name: 'B', lat: 35.01, lng: 139.01 } },
    { id: 'c', type: 'meal', title: 'C', start: '12:00', end: '13:00' },
  ] }],
  documents: [{ id: 'doc1', title: 'Doc', status: 'pending', day: 'd01', itemId: 'a' }],
  checklists: [{ id: 'cl', kind: 'dia', title: 'L', scope: 'day', day: 'd01', sections: [{ title: null, items: [{ id: 'cl-0', text: 'x', done: false }] }] }],
});

test('toMin y fmtMin', () => {
  assert.equal(M.toMin('09:05'), 545); assert.equal(M.toMin('24:00'), null); assert.equal(M.toMin(''), null);
  assert.equal(M.fmtMin(545), '09:05');
});
test('duración, incluido vuelo nocturno', () => {
  assert.equal(M.duration({ start: '09:00', end: '10:30' }, 'Asia/Tokyo'), '1 h 30 min');
  assert.equal(M.duration({ start: '23:30', end: '00:15' }, 'Asia/Tokyo'), '45 min');
  assert.equal(M.duration({ start: '11:35', end: '08:45', tz: 'Europe/Berlin', endTz: 'Asia/Tokyo', endDayOffset: 1 }, 'Europe/Madrid'), '');
});
test('día actual según la zona horaria del día', () => {
  const t = mini();
  assert.equal(M.currentDayIndex(t, new Date('2026-10-30T02:00:00Z')), 0); // 11:00 en Tokio
  assert.equal(M.currentDayIndex(t, new Date('2026-10-29T14:00:00Z')), -1); // 23:00 del 29 en Tokio
});
test('ahora y siguiente', () => {
  const d = mini().days[0];
  let s = M.dayStatus(d, M.toMin('09:30'));
  assert.equal(s.cur.id, 'a'); assert.equal(s.next.id, 'b'); assert.equal(s.leg.id, 'w');
  s = M.dayStatus(d, M.toMin('11:30'));
  assert.equal(s.cur, null); assert.equal(s.next.id, 'c');
  d.items[0].done = true;
  s = M.dayStatus(d, M.toMin('09:30'));
  assert.equal(s.cur, null); assert.equal(s.next.id, 'b');
});
test('numeración de marcadores sigue el orden de la lista', () => {
  const d = mini().days[0];
  assert.deepEqual(M.markerOrder(d), { a: 1, b: 2 });
  [d.items[0], d.items[2]] = [d.items[2], d.items[0]];
  assert.deepEqual(M.markerOrder(d), { b: 1, a: 2 });
  assert.ok(Object.keys(M.chronologyWarnings(d)).length > 0, 'avisa de horas desordenadas');
});
test('aviso de solape sin reescribir', () => {
  const d = mini().days[0];
  d.items[3].start = '10:30';
  const w = M.chronologyWarnings(d);
  assert.match(w.c, /solapa/);
  assert.equal(d.items[3].start, '10:30');
});
test('URLs de Google Maps codificadas', () => {
  const u = M.mapsDirUrl({ name: 'Sensō-ji', address: 'Asakusa' }, { name: 'Kappabashi & co' }, 'metro');
  assert.match(u, /travelmode=transit/); assert.ok(!u.includes(' ')); assert.ok(u.includes('%26'));
  assert.equal(M.mapsSearchUrl({ name: 'X', mapsUrl: 'https://maps.app.goo.gl/abc' }), 'https://maps.app.goo.gl/abc');
});
test('validación detecta errores legibles', () => {
  assert.deepEqual(M.validateTrip(mini()), []);
  const bad = mini(); bad.days[0].items[1].id = 'a'; bad.days[0].items[0].start = '25:00'; bad.schemaVersion = 99;
  const e = M.validateTrip(bad);
  assert.ok(e.some(x => x.includes('repetido'))); assert.ok(e.some(x => x.includes('no válida'))); assert.ok(e.some(x => x.includes('versión')));
  assert.ok(M.validateTrip(null).length);
});
test('fusión: conserva hecho, notas, añadidos y detecta conflictos', () => {
  const base = mini();
  const local = structuredClone(base);
  local.days[0].items[0].done = true;
  local.days[0].items[0].userNote = 'nota';
  local.days[0].items[2] = M.editItem(local.days[0].items[2], { start: '10:30' });
  local.days[0].items.push({ id: 'u1', type: 'task', title: 'Mío', userAdded: true });
  local.checklists[0].sections[0].items[0].done = true;
  local.documents[0].files = ['f1'];
  const incoming = structuredClone(base);
  incoming.days[0].items[2].start = '10:20'; // cambio en Notion sobre un campo editado → conflicto
  incoming.days[0].items[3].title = 'C nuevo'; // cambio sin conflicto
  incoming.days[0].items.splice(1, 1); // desaparece "w"
  const { trip, conflicts, summary } = M.mergeImport(local, incoming, base);
  const it = id => trip.days[0].items.find(x => x.id === id);
  assert.equal(it('a').done, true); assert.equal(it('a').userNote, 'nota');
  assert.equal(it('b').start, '10:30'); assert.equal(conflicts.length, 1); assert.equal(conflicts[0].incoming, '10:20');
  assert.equal(it('c').title, 'C nuevo');
  assert.ok(it('u1')); assert.ok(it('w').missingFromSource);
  assert.equal(trip.checklists[0].sections[0].items[0].done, true);
  assert.deepEqual(trip.documents[0].files, ['f1']); assert.equal(trip.documents[0].status, 'available');
  assert.equal(summary.missing, 1); assert.equal(summary.localOnly, 1);
});

test('los enlaces del móvil se conservan al reimportar', () => {
  const cur = { days: [{ id: 'd1', items: [] }], userLinks: [{ id: 'l1', url: 'https://pin.it/x' }] };
  const inc = { days: [{ id: 'd1', items: [] }] };
  assert.equal(M.mergeImport(cur, inc, null).trip.userLinks[0].id, 'l1');
});

test('tipo y título de enlaces', () => {
  assert.equal(M.linkKind('https://maps.app.goo.gl/abc'), 'gmaps');
  assert.equal(M.linkKind('https://www.google.com/maps/@35,139,12z'), 'gmaps');
  assert.equal(M.linkKind('https://goo.gl/abc'), 'web');
  assert.equal(M.linkKind('https://pin.it/2abc'), 'pinterest');
  assert.equal(M.linkKind('https://es.pinterest.com/user/japon/'), 'pinterest');
  assert.equal(M.linkKind('https://vm.tiktok.com/ZM123/'), 'tiktok');
  assert.equal(M.linkKind('https://www.instagram.com/reel/C1/'), 'instagram');
  assert.equal(M.linkKind('https://youtu.be/xyz'), 'youtube');
  assert.equal(M.linkKind('no es url'), 'web');
  assert.equal(M.linkDefaultTitle('https://www.instagram.com/reel/C1/'), 'Reel de Instagram');
  assert.equal(M.normalizeUrl('Mira esto https://pin.it/2abc ¡guay!'), 'https://pin.it/2abc');
  assert.equal(M.normalizeUrl('tiktok.com/@a/video/1'), 'https://tiktok.com/@a/video/1');
  assert.equal(M.normalizeUrl('hola'), null);
});

test('resumen de ruta de un día', () => {
  const L = (lat, lng) => ({ lat, lng });
  const d = { items: [
    { id: 'a', type: 'visit', title: 'A', start: '09:00', location: L(35.0, 135.0) },
    { id: 't', type: 'transport', mode: 'train', title: 'Tren' },
    { id: 'b', type: 'visit', title: 'B', start: '11:00', end: '12:00', location: L(35.0, 135.1), done: true },
    { id: 'c', type: 'meal', title: 'C' },
  ] };
  const s = M.daySummary(d);
  assert.equal(s.stops, 3); assert.equal(s.mapped, 2); assert.equal(s.legs, 1);
  assert.deepEqual(s.modes, ['train']); assert.equal(s.first, 'A'); assert.equal(s.last, 'B');
  assert.equal(s.from, '09:00'); assert.equal(s.to, '12:00'); assert.equal(s.done, 1);
  assert.ok(s.km > 9 && s.km < 9.3);
});

const DATA = new URL('../../viajes-data/out/japon-2026.json', import.meta.url);
test('el dataset real es válido y tiene 18 días', { skip: !existsSync(DATA) }, () => {
  const t = JSON.parse(readFileSync(DATA, 'utf8'));
  assert.deepEqual(M.validateTrip(t), []);
  assert.equal(t.days.length, 18);
  assert.equal(t.days[0].date, '2026-10-28'); assert.equal(t.days.at(-1).date, '2026-11-14');
  for (const d of t.days) assert.ok(d.source.url.startsWith('https://app.notion.com/p/'));
  const docsLinked = t.documents.filter(d => d.itemId);
  assert.ok(docsLinked.length > 20);
});

test('hora local de una zona a instante absoluto', () => {
  assert.equal(new Date(M.zonedEpoch('2026-10-28', '17:15', 'Europe/Madrid')).toISOString(), '2026-10-28T16:15:00.000Z'); // horario de invierno
  assert.equal(new Date(M.zonedEpoch('2026-10-24', '22:00', 'Europe/Madrid')).toISOString(), '2026-10-24T20:00:00.000Z'); // horario de verano
  assert.equal(new Date(M.zonedEpoch('2026-10-30', '08:45', 'Asia/Tokyo')).toISOString(), '2026-10-29T23:45:00.000Z');
});
test('cuenta atrás', () => {
  assert.deepEqual(M.breakdown((3 * 86400 + 5 * 3600 + 7 * 60 + 30) * 1000), { days: 3, hours: 5, minutes: 7 });
  assert.deepEqual(M.breakdown(-5), { days: 0, hours: 0, minutes: 0 });
  const s = M.tripStart(mini());
  assert.equal(s.time, '09:00');
  const t2 = mini(); t2.days[0].items.unshift({ id: 'ci', type: 'task', title: 'Check-in', start: '00:05' }, { id: 'car', type: 'transport', mode: 'car', title: 'Coche', start: '08:30' });
  assert.equal(M.tripStart(t2).time, '08:30');
  assert.equal(M.calendarDaysUntil('2026-10-28', 'Europe/Madrid', new Date('2026-10-27T11:00:00Z')), 1);
  assert.equal(M.calendarDaysUntil('2026-10-28', 'Europe/Madrid', new Date('2026-10-27T23:30:00Z')), 0);
});
