/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IndexedDB Storage Layer for Clinician Protocols & Beat Templates
 * Provides high-capacity, persistent local storage for designed sequences.
 */

import { StimulationProtocol, BeatTemplate } from '../types/telemetry';

const DB_NAME = 'StimProfilerDB';
const DB_VERSION = 2; // Bumped for beats store
const STORE_NAME = 'protocols';
const BEAT_STORE = 'beats';

export class ProtocolStorage {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(BEAT_STORE)) {
          db.createObjectStore(BEAT_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Protocol Methods
  public async saveProtocol(protocol: StimulationProtocol): Promise<string> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        ...protocol,
        lastModified: Date.now(),
      });

      request.onsuccess = () => resolve(request.result.toString());
      request.onerror = () => reject(request.error);
    });
  }

  public async getProtocols(): Promise<StimulationProtocol[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteProtocol(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(typeof id === 'string' ? Number(id) : id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Beat Template Methods
  public async saveBeat(beat: BeatTemplate): Promise<string> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BEAT_STORE, 'readwrite');
      const store = transaction.objectStore(BEAT_STORE);
      const request = store.put({
        ...beat,
        lastModified: Date.now(),
      });

      request.onsuccess = () => resolve(request.result.toString());
      request.onerror = () => reject(request.error);
    });
  }

  public async getBeats(): Promise<BeatTemplate[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BEAT_STORE, 'readonly');
      const store = transaction.objectStore(BEAT_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteBeat(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(BEAT_STORE, 'readwrite');
      const store = transaction.objectStore(BEAT_STORE);
      const request = store.delete(typeof id === 'string' ? Number(id) : id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const storage = new ProtocolStorage();
