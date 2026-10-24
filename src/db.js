// Almacenamiento local en IndexedDB.
// Almacenes: "kv" (viajes, bases de importación, ajustes) y "files" (archivos de documentos).
const DB_NAME = 'viajes', DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) return reject(new Error('Este navegador no permite guardar datos (IndexedDB no disponible).'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('files')) {
        const s = db.createObjectStore('files', { keyPath: 'id' });
        s.createIndex('docId', 'docId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña abierta de la app.'));
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(r => { out = r; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Operación cancelada'));
  }));
}
const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export const kvGet = key => tx('kv', 'readonly', s => wrap(s.get(key)));
export const kvSet = (key, val) => tx('kv', 'readwrite', s => wrap(s.put(val, key)));
export const kvDel = key => tx('kv', 'readwrite', s => wrap(s.delete(key)));
export const kvKeys = () => tx('kv', 'readonly', s => wrap(s.getAllKeys()));

export const fileAdd = rec => tx('files', 'readwrite', s => wrap(s.put(rec)));
export const fileGet = id => tx('files', 'readonly', s => wrap(s.get(id)));
export const fileDel = id => tx('files', 'readwrite', s => wrap(s.delete(id)));
export const filesForDoc = docId => tx('files', 'readonly', s => wrap(s.index('docId').getAll(docId)));

/** Pide al navegador que no borre los datos de la app. Devuelve true si lo concede. */
export async function requestPersist() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}
export async function storageEstimate() {
  try { return navigator.storage?.estimate ? await navigator.storage.estimate() : null; } catch { return null; }
}
