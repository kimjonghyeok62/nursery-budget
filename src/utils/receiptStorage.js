const DB_NAME = 'nursery-receipts';
const STORE = 'receipts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReceiptLocally(dataUrl) {
  const key = `receipt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(dataUrl, key);
    tx.oncomplete = () => resolve(`local:${key}`);
    tx.onerror = () => reject(tx.error);
  });
}

export async function resolveReceiptUrl(url) {
  if (!url?.startsWith('local:')) return url;
  const key = url.slice(6);
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result || '');
    req.onerror = () => resolve('');
  });
}

export async function deleteReceiptLocally(url) {
  if (!url?.startsWith('local:')) return;
  const key = url.slice(6);
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(key);
}
