import type { Take } from './recordingAudio.web';

const storeName = 'takes';
const memory = new Map<string, Take>();
let database: Promise<IDBDatabase> | undefined;
let persistent = true;
let pending = Promise.resolve();

function enqueue<T>(task: () => Promise<T>) {
  const next = pending.then(task);
  pending = next.then(
    () => {},
    () => {},
  );
  return next;
}

function open() {
  return (database ??= new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open('clasro.recordings', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onblocked = () => reject(new Error('El almacenamiento de tomas está bloqueado.'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!persistent) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
  }));
}

async function transact<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error ?? request.error);
    tx.onerror = () => reject(tx.error ?? request.error);
  });
}

function fallback() {
  persistent = false;
  void database?.then(
    (db) => db.close(),
    () => {},
  );
}

function snapshot() {
  return {
    takes: [...memory.values()].sort((a, b) => b.createdAt - a.createdAt),
    persistent,
  };
}

export function listTakes() {
  return enqueue(async () => {
    if (persistent) {
      try {
        const takes = (await transact('readonly', (store) => store.getAll())) as Take[];
        memory.clear();
        for (const take of takes) memory.set(take.id, take);
      } catch {
        fallback();
      }
    }
    return snapshot();
  });
}

export function saveTake(take: Take) {
  return enqueue(async () => {
    if (persistent) {
      try {
        await transact('readwrite', (store) => store.put(take));
      } catch {
        fallback();
      }
    }
    memory.set(take.id, take);
    return snapshot();
  });
}

export function deleteTake(id: string) {
  return enqueue(async () => {
    if (persistent) {
      try {
        await transact('readwrite', (store) => store.delete(id));
      } catch {
        fallback();
      }
    }
    memory.delete(id);
    return snapshot();
  });
}
