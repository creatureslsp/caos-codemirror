// IndexedDB open/upgrade and small promise wrappers around the callback-based
// IndexedDB API. No wrapper library (idb/Dexie) per
// ../../../plan-webapp/00-risks-and-open-questions.md's storage decision.

export const DB_NAME = "caos-editor";
export const DB_VERSION = 1;

export const STORE_FILES = "files";
export const STORE_PROJECTS = "projects";
export const STORE_KV = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_FILES)) {
    const files = db.createObjectStore(STORE_FILES, { keyPath: "id" });
    files.createIndex("parentProjectId", "parentProjectId");
    files.createIndex("deletedDate", "deletedDate");
    files.createIndex("lastModifiedDate", "lastModifiedDate");
    files.createIndex("nameNormalized", "nameNormalized");
  }
  if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
    const projects = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
    projects.createIndex("deletedDate", "deletedDate");
    projects.createIndex("lastModifiedDate", "lastModifiedDate");
    projects.createIndex("nameNormalized", "nameNormalized");
  }
  if (!db.objectStoreNames.contains(STORE_KV)) {
    db.createObjectStore(STORE_KV, { keyPath: "key" });
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => upgrade(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

/**
 * Test-only: drops the cached connection and deletes the database so each
 * test starts from a clean slate. Not called from app code.
 */
export async function resetDbForTests(): Promise<void> {
  const existing = dbPromise;
  dbPromise = null;
  if (existing) {
    (await existing).close();
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE_KV, "readonly");
  const record = await promisifyRequest<{ key: string; value: T } | undefined>(
    tx.objectStore(STORE_KV).get(key)
  );
  return record?.value;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_KV, "readwrite");
  tx.objectStore(STORE_KV).put({ key, value });
  await promisifyTransaction(tx);
}
