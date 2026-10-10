/**
 * App-lifetime services: one engine worker and one store (ARCH 6: the worker outlives routes).
 * Owner: WP-08. Browser only.
 */
import { createDb, createStore, type Store } from '@ibasho/store';
import { createContext, useContext } from 'react';
import { connectEngine, type RemoteEngine, startWorker } from '../engine/client.ts';
import { manifest } from '../manifest.ts';

let engine: Promise<RemoteEngine> | null = null;
let store: Store | null | undefined;

export function getEngine(): Promise<RemoteEngine> {
  if (!engine) {
    const worker = startWorker();
    engine = connectEngine(worker, manifest).catch((e: unknown) => {
      worker.terminate();
      engine = null;
      throw e;
    });
  }
  return engine;
}

/** The store, or null where IndexedDB is unavailable. */
export function getStore(): Store | null {
  if (store === undefined) {
    try {
      store = typeof indexedDB === 'undefined' ? null : createStore(createDb());
    } catch {
      store = null;
    }
  }
  return store;
}

export interface Services {
  engine(): Promise<RemoteEngine>;
  store(): Store | null;
}

/** Browser services by default; tests provide an engine on a `MessageChannel`. */
export const ServicesContext = createContext<Services>({ engine: getEngine, store: getStore });
export const useServices = (): Services => useContext(ServicesContext);
