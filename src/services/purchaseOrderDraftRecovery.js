// Refresh recovery is local to the signed-in user and form context. It never
// creates a purchase order or sends an approval request.
export const PURCHASE_ORDER_DRAFT_PREFIX = 'radai:po-draft:v1:';
const DATABASE_NAME = 'radai-purchase-order-drafts';
const STORE_NAME = 'drafts';
const TAB_STORAGE_KEY = 'radai:po-draft-tab:v1';
const FILE_MARKER = '__purchaseOrderDraftFile';
const writeQueues = new Map();
const fileIds = new WeakMap();

function browserStorage(name) {
  try { return globalThis[name] || null; } catch { return null; }
}

function uniqueId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function tabDatabaseKey(key, storage) {
  if (!key) return null;
  try {
    if (!storage) return key;
    let tabId = storage.getItem(TAB_STORAGE_KEY);
    if (!tabId) {
      tabId = uniqueId();
      storage.setItem(TAB_STORAGE_KEY, tabId);
    }
    // IndexedDB is shared across tabs; sessionStorage is not. Keep each tab's
    // binary snapshot with its own fields instead of replacing another PO.
    return `${key}:tab:${tabId}`;
  } catch { return key; }
}

export function currentPurchaseOrderDraftUser(storage = browserStorage('localStorage')) {
  try {
    const token = storage?.getItem('radai_access_token') || storage?.getItem('access');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
      if (payload.user_id != null || payload.sub != null) return String(payload.user_id ?? payload.sub);
    } catch { /* Some authenticated clients use opaque access tokens. */ }
    const profile = JSON.parse(storage?.getItem('radai_user_data') || 'null');
    const id = profile?.user?.id ?? profile?.id;
    return id == null ? null : String(id);
  } catch { return null; }
}

export function purchaseOrderRecoveryKey({ userId, orderId, requisitionId, projectId } = {}) {
  if (userId == null || userId === '') return null;
  return PURCHASE_ORDER_DRAFT_PREFIX + [userId, orderId ? `edit:${orderId}` : 'new', requisitionId || '', projectId || '']
    .map(value => encodeURIComponent(String(value))).join(':');
}

function queueWrite(key, action) {
  const previous = writeQueues.get(key) || Promise.resolve();
  const pending = previous.catch(() => {}).then(action);
  writeQueues.set(key, pending);
  pending.finally(() => { if (writeQueues.get(key) === pending) writeQueues.delete(key); }).catch(() => {});
  return pending;
}

function indexedDatabasePersistence(indexedDB = browserStorage('indexedDB')) {
  let databasePromise;
  const open = () => {
    if (!indexedDB) return Promise.reject(new Error('Browser draft storage is unavailable.'));
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(new Error('Browser draft storage is unavailable.'));
      }, 2000);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (settled) { request.result.close(); return; }
        settled = true;
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = request.onblocked = () => {
        clearTimeout(timer);
        settled = true;
        reject(request.error || new Error('Browser draft storage is unavailable.'));
      };
    });
    return databasePromise;
  };
  const transact = async (mode, operation) => {
    const database = await open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error || request.error || new Error('Draft storage failed.'));
    });
  };
  return {
    get: key => transact('readonly', store => store.get(key)),
    put: (key, value) => transact('readwrite', store => store.put(value, key)),
    delete: key => transact('readwrite', store => store.delete(key)),
  };
}

function encodeSnapshot(snapshot) {
  const files = [];
  const serialized = JSON.stringify(snapshot, (_key, value) => {
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      let id = fileIds.get(value);
      if (!id) {
        id = uniqueId();
        fileIds.set(value, id);
      }
      const metadata = { [FILE_MARKER]: id, name: value.name || 'attachment', type: value.type, size: value.size, lastModified: value.lastModified };
      files.push({ id, file: value, name: metadata.name, lastModified: metadata.lastModified });
      return metadata;
    }
    return value;
  });
  return { snapshot: JSON.parse(serialized), files };
}

function decodeSnapshot(snapshot, files = [], missingFiles = []) {
  const availableFiles = new Map(files.map(entry => [entry.id, entry]));
  return JSON.parse(JSON.stringify(snapshot), (_key, value) => {
    if (!value || !value[FILE_MARKER]) return value;
    const entry = availableFiles.get(value[FILE_MARKER]);
    if (!entry?.file) {
      missingFiles.push(value.name);
      return null;
    }
    let file = entry.file;
    // Some engines deserialize a File as a Blob. Restore the upload filename.
    if (typeof File !== 'undefined' && !(file instanceof File)) {
      file = new File([file], entry.name, { type: file.type, lastModified: entry.lastModified });
    }
    fileIds.set(file, entry.id);
    return file;
  });
}

/**
 * read() provides synchronous field recovery. Await load() before enabling the
 * form/autosave so attachment bytes and the original server draft ID are ready.
 * save() persists fields immediately and returns a promise for attachment bytes.
 * clear() is only for explicit cancel or successful save, never for unmount.
 * After clear(), this controller rejects subsequent writes (including cleanup).
 */
export function createPurchaseOrderDraftRecovery({
  key,
  storage = browserStorage('sessionStorage'),
  persistence = indexedDatabasePersistence(),
} = {}) {
  const databaseKey = tabDatabaseKey(key, storage);
  let active = Boolean(key);
  let sequence = Date.now();
  let current = null;
  let inMemoryFiles = [];
  let missingFiles = [];
  let sessionAvailable = Boolean(storage);
  let databaseAvailable = true;

  const readRecord = () => {
    if (!key) return null;
    try {
      const record = JSON.parse(storage?.getItem(key) || 'null');
      return record?.version === 1 ? record : null;
    } catch { return null; }
  };
  const writeRecord = record => {
    try {
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(record));
      sessionAvailable = true;
      return true;
    } catch { sessionAvailable = false; return false; }
  };
  const nextSequence = () => { sequence = Math.max(Date.now(), sequence + 1); return sequence; };
  current = readRecord();
  if (current?.sequence) sequence = Math.max(sequence, current.sequence);

  const controller = {
    get key() { return key; },
    get missingFiles() { return [...missingFiles]; },
    get storageAvailable() { return sessionAvailable || databaseAvailable; },
    read() {
      return current?.snapshot && !current.discarded ? decodeSnapshot(current.snapshot, inMemoryFiles) : null;
    },
    async load() {
      if (!active || current?.discarded) return null;
      let stored;
      try { stored = await persistence.get(databaseKey); } catch { databaseAvailable = false; }
      if (!active) return null;
      // Fields saved immediately before a refresh may be newer than the last
      // completed binary write. Keep those fields and match files by identity.
      const session = readRecord();
      if (session?.discarded) { current = session; return null; }
      if (session && (!current || session.sequence > current.sequence)) current = session;
      if (stored?.version === 1 && (!current || stored.sequence > current.sequence)) current = stored;
      if (!current?.snapshot || current.discarded) return null;
      sequence = Math.max(sequence, current.sequence || 0);
      missingFiles = [];
      inMemoryFiles = [...(stored?.files || []), ...inMemoryFiles];
      const result = decodeSnapshot(current.snapshot, inMemoryFiles, missingFiles);
      return result;
    },
    save(snapshot) {
      if (!active) return Promise.resolve(false);
      let encoded;
      try { encoded = encodeSnapshot(snapshot); } catch { return Promise.resolve(false); }
      const record = { version: 1, sequence: nextSequence(), snapshot: encoded.snapshot };
      current = record;
      inMemoryFiles = encoded.files;
      const sessionSaved = writeRecord(record);
      return queueWrite(databaseKey, async () => {
        if (!active) return false;
        // Every snapshot contains its complete attachment set. If typing has
        // already queued a newer snapshot, only that latest one needs a binary
        // write; the synchronous session fields are already current.
        if (current.sequence !== record.sequence) return sessionSaved;
        try {
          await persistence.put(databaseKey, { ...record, files: encoded.files });
          databaseAvailable = true;
          return true;
        } catch { databaseAvailable = false; return sessionSaved; }
      });
    },
    clear() {
      if (!active) return Promise.resolve();
      active = false;
      inMemoryFiles = [];
      missingFiles = [];
      const tombstone = { version: 1, sequence: nextSequence(), discarded: true };
      current = tombstone;
      // This tombstone also blocks recovery if the page closes before the
      // asynchronous delete completes, or IndexedDB is temporarily blocked.
      writeRecord(tombstone);
      return queueWrite(databaseKey, async () => {
        try {
          await persistence.delete(databaseKey);
          if (readRecord()?.sequence === tombstone.sequence) storage?.removeItem(key);
        } catch { /* Keep the tombstone if the binary store could not be cleared. */ }
      });
    },
  };
  return controller;
}
