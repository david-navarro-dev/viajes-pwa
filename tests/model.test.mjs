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
