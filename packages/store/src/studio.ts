/**
 * Studio repositories over the v2 tables (ARCH 15.8). Owner: WP-08. Layer L1.
 *
 * Places and buildings, append-only documents, editor commands, variants, results by inputs hash
 * and scoped settings. Restart is here too: `branchPlace` copies a place with its buildings and
 * active documents into a new place with a lineage link and never touches the original (AC-RS1).
 */
import type { BuildingDoc, BuildingResult, Setting } from '@ibasho/core';
import type { Clock } from './repos.ts';
import type { IbashoDb } from './schema.ts';
import type {
  BuildingRow,
  CommandRow,
  DocRow,
  PlaceRow,
  ScopedSettingRow,
  VariantRow,
} from './studio-rows.ts';

const isoNow: Clock = () => new Date().toISOString();

export interface StudioStore {
  places: {
    list(): Promise<PlaceRow[]>;
    get(id: string): Promise<PlaceRow | undefined>;
    put(row: PlaceRow): Promise<void>;
    /** Mark a visit and return the previous visit (Revisit), with what was last seen. */
    visit(
      id: string,
      seen?: Record<string, string>,
    ): Promise<{ visitedAt?: string; seen?: Record<string, string> }>;
    /** Start over keeps everything; this deletes only on an explicit request. */
    remove(id: string): Promise<void>;
  };
  buildings: {
    get(id: string): Promise<BuildingRow | undefined>;
    byPlace(placeId: string): Promise<BuildingRow[]>;
    put(row: BuildingRow): Promise<void>;
  };
  docs: {
    /** Append `doc` as the next version of its building and make it active. Returns the version. */
    append(doc: BuildingDoc, label?: string): Promise<number>;
    active(buildingId: string): Promise<DocRow | undefined>;
    list(buildingId: string): Promise<DocRow[]>;
  };
  commands: {
    append(row: Omit<CommandRow, 'seq' | 'at'>): Promise<number>;
    list(buildingId: string): Promise<CommandRow[]>;
  };
  variants: {
    list(buildingId: string): Promise<VariantRow[]>;
    put(row: VariantRow): Promise<void>;
    remove(id: string): Promise<void>;
  };
  results: {
    put(buildingId: string, result: BuildingResult, variantId?: string): Promise<void>;
    get(inputsHash: string): Promise<BuildingResult | undefined>;
  };
  settings: {
    list(): Promise<ScopedSettingRow[]>;
    put(s: Setting): Promise<void>;
    remove(s: Pick<Setting, 'id' | 'scope' | 'scopeId'>): Promise<void>;
  };
  /** Restart > Branch: copy a place, its buildings and their active documents. Returns the new place id. */
  branchPlace(placeId: string, name: string, newId: (prefix: string) => string): Promise<string>;
}

export function createStudioStore(db: IbashoDb, now: Clock = isoNow): StudioStore {
  const appendDoc = (doc: BuildingDoc, label?: string) =>
    db.transaction('rw', db.buildings, db.docs, async () => {
      const prev = await db.docs.where('buildingId').equals(doc.id).primaryKeys();
      const version = prev.length === 0 ? 1 : Math.max(...prev.map((k) => k[1])) + 1;
      const at = now();
      await db.docs.add({
        buildingId: doc.id,
        version,
        doc: { ...doc, version },
        at,
        ...(label ? { label } : {}),
      });
      const old = await db.buildings.get(doc.id);
      await db.buildings.put({
        id: doc.id,
        placeId: doc.placeId,
        name: doc.name,
        typeId: doc.typeId,
        activeVersion: version,
        updatedAt: at,
        ...(old?.lineage ? { lineage: old.lineage } : {}),
      });
      return version;
    });

  return {
    places: {
      list: () => db.places.orderBy('updatedAt').reverse().toArray(),
      get: (id) => db.places.get(id),
      put: async (row) => {
        await db.places.put(row);
      },
      visit: (id, seen) =>
        db.transaction('rw', db.places, async () => {
          const row = await db.places.get(id);
          if (!row) return {};
          const before = {
            ...(row.visitedAt ? { visitedAt: row.visitedAt } : {}),
            ...(row.seen ? { seen: row.seen } : {}),
          };
          await db.places.put({ ...row, visitedAt: now(), ...(seen ? { seen } : {}) });
          return before;
        }),
      remove: (id) =>
        db.transaction('rw', db.places, db.buildings, db.docs, async () => {
          const bs = await db.buildings.where('placeId').equals(id).primaryKeys();
          for (const b of bs) await db.docs.where('buildingId').equals(b).delete();
          await db.buildings.bulkDelete(bs);
          await db.places.delete(id);
        }),
    },
    buildings: {
      get: (id) => db.buildings.get(id),
      byPlace: (placeId) => db.buildings.where('placeId').equals(placeId).toArray(),
      put: async (row) => {
        await db.buildings.put(row);
      },
    },
    docs: {
      append: appendDoc,
      active: async (buildingId) => {
        const b = await db.buildings.get(buildingId);
        return b && b.activeVersion > 0 ? db.docs.get([buildingId, b.activeVersion]) : undefined;
      },
      list: (buildingId) => db.docs.where('buildingId').equals(buildingId).sortBy('version'),
    },
    commands: {
      append: (row) =>
        db.transaction('rw', db.commands, async () => {
          const seq =
            (await db.commands
              .where('[buildingId+seq]')
              .between([row.buildingId, 0], [row.buildingId, Infinity])
              .count()) + 1;
          await db.commands.add({ ...row, seq, at: now() });
          return seq;
        }),
      list: (buildingId) =>
        db.commands.where('[buildingId+seq]').between([buildingId, 0], [buildingId, Infinity]).toArray(),
    },
    variants: {
      list: (buildingId) => db.variants.where('buildingId').equals(buildingId).toArray(),
      put: async (row) => {
        await db.variants.put(row);
      },
      remove: async (id) => {
        await db.variants.delete(id);
      },
    },
    results: {
      put: async (buildingId, result, variantId) => {
        await db.buildingResults.put({
          inputsHash: result.inputsHash,
          buildingId,
          createdAt: now(),
          result,
          ...(variantId ? { variantId } : {}),
        });
      },
      get: async (h) => (await db.buildingResults.get(h))?.result,
    },
    settings: {
      list: () => db.scopedSettings.toArray(),
      put: async (s) => {
        await db.scopedSettings.put({ ...s, scopeId: s.scopeId ?? '' });
      },
      remove: async (s) => {
        await db.scopedSettings.delete([s.scope, s.scopeId ?? '', s.id]);
      },
    },
    branchPlace: (placeId, name, newId) =>
      db.transaction('rw', db.places, db.buildings, db.docs, async () => {
        const src = await db.places.get(placeId);
        if (!src) throw new Error(`no place ${placeId}`);
        const at = now();
        const pid = newId('pl');
        const ids: string[] = [];
        for (const b of await db.buildings.where('placeId').equals(placeId).toArray()) {
          const bid = newId('bd');
          ids.push(bid);
          const active = b.activeVersion > 0 ? await db.docs.get([b.id, b.activeVersion]) : undefined;
          await db.buildings.put({
            ...b,
            id: bid,
            placeId: pid,
            activeVersion: active ? 1 : 0,
            updatedAt: at,
            lineage: { from: b.id, at },
          });
          if (active) {
            const doc: BuildingDoc = structuredClone({ ...active.doc, id: bid, placeId: pid, version: 1 });
            await db.docs.add({ buildingId: bid, version: 1, doc, at, label: 'Branched' });
          }
        }
        const { visitedAt: _v, seen: _s, sample: _sample, ...rest } = src;
        await db.places.put({
          ...rest,
          id: pid,
          name,
          buildingIds: ids,
          updatedAt: at,
          lineage: { from: placeId, at: at.slice(0, 10) as `${number}-${number}-${number}` },
        });
        return pid;
      }),
  };
}
