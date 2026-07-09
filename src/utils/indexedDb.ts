/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DbRecording {
  id: string;
  name: string;
  timestamp: number;
  duration: number; // in seconds
  blob: Blob;
  format: 'webm' | 'wav' | 'mp4';
  source: 'mic' | 'system' | 'both';
  fileSize: number; // in bytes
}

const DB_NAME = 'PrivacyAudioRecorderDB';
const DB_VERSION = 2;
const RECORDINGS_STORE = 'recordings';
const SETTINGS_STORE = 'settings';

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
        db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
  });
}

export async function saveRecordingToDb(recording: DbRecording): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
    const store = transaction.objectStore(RECORDINGS_STORE);
    const request = store.put(recording);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRecordingsFromDb(): Promise<DbRecording[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORDINGS_STORE, 'readonly');
    const store = transaction.objectStore(RECORDINGS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by newest timestamp first
      const results = request.result as DbRecording[];
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecordingFromDb(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
    const store = transaction.objectStore(RECORDINGS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function removeSetting(key: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
