/**
 * Studio state (SPEC 17, 18, 19). Owner: WP-08.
 *
 * One zustand store for the session: places, buildings (document, editor history, versions,
 * variants), settings, and one job per building variant with its stage bar, stage views, evidence
 * nodes, tiers and stale marks. Persistence goes through `@ibasho/store` v2 (`persist.ts`).
 *
 * Flows:
 * - New: `createPlace`, `createBuilding` (from a template or the sample), then `run`.
 * - Revisit: `visit` returns the previous visit and what changed (prices, codes, weather, packs).
 * - Restart: `startOver` (a new empty place, the old one stays) and `branch` (copy with lineage).
 * - Current plus what-if: `addVariant`, `setLever`, each lever recomputes the whole variant.
 * - Update: `editDoc` and `setSetting` mark dependent stages stale at once and re-run only
 *   the stages the change touches (`downstreamStages`).
 */
import type {
  BuildingDoc,
  BuildingTypeId,
  CityTile,
  EvidenceNode,
  Place,
  ResolutionLevel,
  StageBarState,
  StageId,
  StageOut,
  Tier,
} from '@ibasho/core';
import { downstreamStages, STUDIO_STAGES } from '@ibasho/core';
import {
  type EditCommand,
  type EditOrigin,
  edit,
  emptyHistory,
  type History,
  type Recipe,
  record,
  redo,
  undo,
} from '@ibasho/editor';
import { create } from 'zustand';
import { STAGE_PROVIDERS } from '../../manifest.ts';
import { areaTiles, contextIdsFor, packsFor, hasSampleDoc, IIIT_PLACE_ID, sampleDoc, samplePlaces } from '../data.ts';
import { startJob } from '../preview/jobs.ts';
import type { JobHandle, RunEvent, StageInputs } from '../preview/runner.ts';
import {
  BASE_LEVERS,
  defaultSettings,
  LEVERS,
  type Levers,
  SETTING_BY_ID,
  type SettingValues,
} from '../preview/settings.ts';
import { variantDoc } from '../preview/variant.ts';
import type { StageViews } from '../preview/views.ts';

export interface Variant {
  id: string;
  name: string;
  /** Only the levers this variant changes from the building as it is (AC-W5: diff equals the list). */
  changes: Levers;
}

export interface Version {
  id: string;
  label: string;
  at: number;
  doc: BuildingDoc;
  origin: EditOrigin;
  euiMid?: number;
}

export interface BuildingEntry {
  id: string;
  placeId: string;
  name: string;
  typeId: BuildingTypeId;
  doc: BuildingDoc;
  history: History;
  versions: Version[];
  variants: Variant[];
  focus: string;
  lineage?: { from: string; at: number };
  sample?: boolean;
}

export interface PlaceEntry {
  place: Place;
  updatedAt: number;
  visitedAt?: number;
  lineage?: { from: string; at: number };
  /** Short context line ("Gachibowli, Hyderabad"). */
  area: string;
}

export interface Job {
  key: string;
  generation: number;
  handle?: JobHandle;
  bar: StageBarState;
  message?: string | undefined;
  views: Partial<StageViews>;
  nodes: Partial<Record<StageId, EvidenceNode[]>>;
  tiers: Partial<Record<StageId, Tier>>;
  stale: Partial<Record<StageId, boolean>>;
  resolution: ResolutionLevel;
  /** Final stage outputs in the core contracts (reused when a later change skips a stage). */
  outputs: Partial<StageOut>;
  /** True when the site stages saw the city context (so tiles arriving later need no rerun). */
  withTiles?: boolean;
  /** Latest output of any tier, for painting rough results at once (review B-M2). */
  latest: Partial<StageOut>;
}

export interface Change {
  what: string;
  before: string;
  after: string;
  source: string;
  kind: 'price' | 'code' | 'weather' | 'pack' | 'engine';
  /** Short phrase for the one-line notice ("new tariff"). */
  short: string;
}

export interface Revisit {
  placeId: string;
  daysAway: number;
  changes: Change[];
  /** Previous tariff, to recompute the old headline for a before and after (never silent). */
  before: SettingValues;
  dismissed?: boolean;
}

export const BASE_VARIANT = 'as-built';
export const jobKey = (buildingId: string, variantId: string): string => `${buildingId}~${variantId}`;

const newId = (p: string): string => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export { variantDoc };

export interface StudioState {
  ready: boolean;
  places: Record<string, PlaceEntry>;
  buildings: Record<string, BuildingEntry>;
  settings: SettingValues;
  userSet: Record<string, true>;
  jobs: Record<string, Job>;
  revisit?: Revisit | undefined;
  deviceFactor: number;
  /** Hyderabad city pack tiles (loaded once). */
  tiles: CityTile[];
  /** The city tiles finished loading (or failed): first runs wait for this so stages never restart. */
  tilesReady: boolean;
  /** Tiles per city area (pack id), loaded on first use; absent while loading. */
  areas: Record<string, CityTile[]>;
  /** Load a city area's tiles once; jobs at places in it that ran without context rerun from the sun. */
  ensureArea(packId: string | undefined): void;
  /** Add an on-demand sample place (and its buildings) when someone searches for or picks it. */
  addSamplePlace(placeId: string): boolean;

  hydrate(snapshot?: Partial<Pick<StudioState, 'places' | 'buildings' | 'settings' | 'userSet'>>): void;
  seedSample(): void;
  createPlace(p: { name: string; lat: number; lon: number; area: string; sample?: boolean }): string;
  createBuilding(placeId: string, typeId: BuildingTypeId, name: string, doc?: BuildingDoc): string;
  startOver(): string;
  branch(placeId: string, name?: string): string;
  removePlace(placeId: string): void;
  visit(placeId: string): Revisit | undefined;
  dismissRevisit(): void;

  editDoc(buildingId: string, label: string, recipe: Recipe, origin?: EditOrigin): void;
  undo(buildingId: string): void;
  redo(buildingId: string): void;
  restoreVersion(buildingId: string, versionId: string): void;
  saveVersion(buildingId: string, label: string): void;

  addVariant(buildingId: string, name?: string, changes?: Levers): string;
  removeVariant(buildingId: string, variantId: string): void;
  setLever(buildingId: string, variantId: string, lever: string, value: number | string): void;
  setFocus(buildingId: string, variantId: string): void;
  applyVariant(buildingId: string, changes: Levers, name: string): string;

  setSetting(id: string, value: number | string): void;
  resetSetting(id: string): void;

  run(buildingId: string, variantId: string, changed?: StageId[]): void;
  runBuilding(buildingId: string, changed?: StageId[]): void;
  cancel(buildingId: string, variantId: string): void;
}

function inputsFor(s: StudioState, b: BuildingEntry, v: Variant, previous: Partial<StageOut>): StageInputs {
  const place = s.places[b.placeId]?.place ?? (samplePlaces()[0] as Place);
  return {
    key: jobKey(b.id, v.id),
    placeId: b.placeId,
    variantId: v.id,
    doc: variantDoc(b.doc, v.changes),
    place,
    tiles: place.cityPackId ? (s.areas[place.cityPackId] ?? []) : [],
    previous,
    replacedIds: contextIdsFor(b.id),
    levers: { ...BASE_LEVERS, ...v.changes },
    settings: s.settings,
    resolution: String(s.settings['analysis.resolution']) as ResolutionLevel,
    asOf: new Date().toISOString(),
  };
}

const loadingAreas = new Set<string>();

export const useStudio = create<StudioState>()((set, get) => {
  const patchJob = (key: string, f: (j: Job) => Job) =>
    set((s) => {
      const j = s.jobs[key];
      return j ? { jobs: { ...s.jobs, [key]: f(j) } } : {};
    });

  const onEvent = (key: string) => (e: RunEvent) => {
    patchJob(key, (j) => {
      if (e.generation !== j.generation) return j; // superseded (H9)
      const stages = j.bar.stages.map((st) =>
        st.id === e.stage
          ? {
              ...st,
              status: e.status === 'done' ? ('done' as const) : ('running' as const),
              fraction: e.fraction,
              ...(e.tier ? { tier: e.tier } : st.tier ? { tier: st.tier } : {}),
              etaMs: e.etaMs,
            }
          : st,
      );
      const next: Job = { ...j, bar: { ...j.bar, stages }, message: e.message };
      if (e.result) {
        next.views = { ...j.views, [e.stage]: e.result.view };
        next.nodes = { ...j.nodes, [e.stage]: e.result.nodes };
        next.tiers = { ...j.tiers, [e.stage]: e.tier };
        if (e.output !== undefined) {
          next.latest = { ...j.latest, [e.stage]: e.output };
          if (e.tier === 'final') next.outputs = { ...j.outputs, [e.stage]: e.output };
        }
        if (e.tier === 'final') next.stale = { ...j.stale, [e.stage]: false };
      }
      return next;
    });
    if (e.stage === 'energy' && e.tier === 'final' && e.result) {
      // The film strip keeps the EUI after each version.
      const [bid, vid] = key.split('~');
      if (bid && vid === BASE_VARIANT) {
        const mid = (e.result.view as StageViews['energy']).euiMid;
        set((s) => {
          const b = s.buildings[bid];
          if (!b?.versions.length) return {};
          const versions = b.versions.map((v, i) =>
            i === b.versions.length - 1 && v.euiMid === undefined ? { ...v, euiMid: mid } : v,
          );
          return { buildings: { ...s.buildings, [bid]: { ...b, versions } } };
        });
      }
    }
  };

  const putBuilding = (b: BuildingEntry) => set((s) => ({ buildings: { ...s.buildings, [b.id]: b } }));

  let snapTimer: ReturnType<typeof setTimeout> | undefined;
  let runTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    ready: false,
    places: {},
    buildings: {},
    settings: defaultSettings(),
    userSet: {},
    jobs: {},
    deviceFactor: 1,
    tiles: [],
    tilesReady: false,
    areas: {},

    ensureArea(packId) {
      if (!packId || get().areas[packId] || loadingAreas.has(packId)) return;
      loadingAreas.add(packId);
      void areaTiles(packId).then((tiles) => {
        set((st) => ({
          areas: { ...st.areas, [packId]: tiles },
          ...(packId === 'city-hyderabad' ? { tiles, tilesReady: true } : {}),
        }));
        if (!tiles.length) return;
        // Context arrived: only jobs that ran without it rerun from the sun (never a running job with tiles).
        for (const b of Object.values(get().buildings)) {
          const j = get().jobs[jobKey(b.id, BASE_VARIANT)];
          const place = get().places[b.placeId]?.place;
          if (j && !j.withTiles && place?.cityPackId === packId) get().runBuilding(b.id, ['sun']);
        }
      });
    },

    addSamplePlace(placeId) {
      if (get().places[placeId]) return true;
      const p = samplePlaces().find((x) => x.id === placeId);
      if (!p) return false;
      const now = Date.now();
      const buildings: Record<string, BuildingEntry> = {};
      for (const id of p.buildingIds) {
        if (!hasSampleDoc(id) || get().buildings[id]) continue;
        const doc = sampleDoc(id);
        buildings[id] = {
          id,
          placeId: p.id,
          name: doc.name,
          typeId: doc.typeId,
          doc,
          history: emptyHistory(),
          versions: [{ id: newId('v'), label: 'From the map and public listings', at: now, doc, origin: 'import' }],
          variants: [{ id: BASE_VARIANT, name: 'As it is', changes: {} }],
          focus: BASE_VARIANT,
          sample: true,
        };
      }
      set((st) => ({
        places: { ...st.places, [p.id]: { place: p, updatedAt: now, visitedAt: now, area: p.name } },
        buildings: { ...st.buildings, ...buildings },
      }));
      get().ensureArea(p.cityPackId);
      return true;
    },

    hydrate(snapshot) {
      set({
        ready: true,
        ...(snapshot?.places ? { places: snapshot.places } : {}),
        ...(snapshot?.buildings ? { buildings: snapshot.buildings } : {}),
        ...(snapshot?.settings ? { settings: { ...defaultSettings(), ...snapshot.settings } } : {}),
        ...(snapshot?.userSet ? { userSet: snapshot.userSet } : {}),
      });
      if (!snapshot?.places || Object.keys(snapshot.places).length === 0) get().seedSample();
      get().ensureArea('city-hyderabad');
    },

    seedSample() {
      const now = Date.now();
      const ago = now - 23 * 86_400_000;
      const places = samplePlaces().filter((p) => p.id === IIIT_PLACE_ID || p.id === 'pl_hitec');
      const area: Record<string, string> = {
        pl_iiit: 'Gachibowli, Hyderabad',
        pl_hitec: 'Madhapur, Hyderabad',
      };
      const buildings: Record<string, BuildingEntry> = {};
      for (const p of places) {
        for (const id of p.buildingIds) {
          const doc = sampleDoc(id);
          buildings[id] = {
            id,
            placeId: p.id,
            name: doc.name,
            typeId: doc.typeId,
            doc,
            history: emptyHistory(),
            versions: [
              {
                id: newId('v'),
                label: id === 'gb1' ? 'Traced from the plan' : 'Sample',
                at: ago,
                doc,
                origin: 'import',
              },
            ],
            variants:
              id === 'gb1'
                ? [
                    { id: BASE_VARIANT, name: 'As it is', changes: {} },
                    {
                      id: 'v_shade',
                      name: 'Shaded and cool',
                      changes: { shading: 'chajja', roof: 'cool', glazing: 'low-e' },
                    },
                  ]
                : [{ id: BASE_VARIANT, name: 'As it is', changes: {} }],
            focus: BASE_VARIANT,
            sample: true,
          };
        }
      }
      set((s) => ({
        places: {
          ...s.places,
          ...Object.fromEntries(
            places.map((p) => [
              p.id,
              {
                place: p,
                updatedAt: p.id === IIIT_PLACE_ID ? ago + 1 : ago,
                // No visit yet: "Since your last visit" appears only on a real return (round 3).
                area: area[p.id] ?? 'Hyderabad',
              },
            ]),
          ),
        },
        buildings: { ...s.buildings, ...buildings },
      }));
    },

    createPlace({ name, lat, lon, area, sample }) {
      const id = newId('pl');
      const place: Place = {
        id,
        name,
        lat,
        lon,
        elevationM: 0,
        trueNorthMdeg: 0,
        ...packsFor(lat, lon),
        buildingIds: [],
        ...(sample ? { sample: true as const } : {}),
      };
      set((s) => ({
        places: { ...s.places, [id]: { place, updatedAt: Date.now(), visitedAt: Date.now(), area } },
      }));
      return id;
    },

    createBuilding(placeId, typeId, name, given) {
      const id = given?.id && !get().buildings[given.id] ? given.id : newId('bd');
      const doc: BuildingDoc = given
        ? { ...structuredClone(given), id, placeId, name, typeId }
        : {
            schema: 'ibasho.building/1',
            id,
            version: 1,
            placeId,
            name,
            typeId,
            origin: { x: 0, y: 0 },
            rotationMdeg: 0,
            storeys: [
              {
                id: 'st_0',
                name: 'Ground floor',
                elevation: 0,
                floorToFloor: typeId === 'office' ? 3600 : typeId === 'lab' ? 4200 : 3200,
                multiplier: 1,
                belowGrade: false,
                rooms: [],
                rooms3d: [],
                cores: [],
              },
            ],
            roofs: [],
            shades: [],
            zones: [],
            systems: [],
          };
      const entry: BuildingEntry = {
        id,
        placeId,
        name,
        typeId,
        doc,
        history: emptyHistory(),
        versions: [{ id: newId('v'), label: 'Started', at: Date.now(), doc, origin: 'person' }],
        variants: [{ id: BASE_VARIANT, name: 'As it is', changes: {} }],
        focus: BASE_VARIANT,
      };
      set((s) => {
        const p = s.places[placeId];
        return {
          buildings: { ...s.buildings, [id]: entry },
          ...(p
            ? {
                places: {
                  ...s.places,
                  [placeId]: {
                    ...p,
                    updatedAt: Date.now(),
                    place: { ...p.place, buildingIds: [...p.place.buildingIds, id] },
                  },
                },
              }
            : {}),
        };
      });
      return id;
    },

    startOver() {
      return get().createPlace({ name: 'New place', lat: 17.44, lon: 78.35, area: 'Hyderabad' });
    },

    branch(placeId, name) {
      const s = get();
      const src = s.places[placeId];
      if (!src) throw new Error(`no place ${placeId}`);
      const pid = newId('pl');
      const now = Date.now();
      const buildings: Record<string, BuildingEntry> = {};
      const ids: string[] = [];
      for (const bid of src.place.buildingIds) {
        const b = s.buildings[bid];
        if (!b) continue;
        const id = newId('bd');
        ids.push(id);
        const doc = structuredClone({ ...b.doc, id, placeId: pid, version: 1 });
        buildings[id] = {
          ...structuredClone({ ...b, history: emptyHistory() }),
          id,
          placeId: pid,
          doc,
          history: emptyHistory(),
          versions: [
            { id: newId('v'), label: `Branched from ${src.place.name}`, at: now, doc, origin: 'person' },
          ],
          lineage: { from: b.id, at: now },
          sample: false,
        } as BuildingEntry;
        delete (buildings[id] as Partial<BuildingEntry>).sample;
      }
      const { sample: _s, ...rest } = src.place;
      set((st) => ({
        places: {
          ...st.places,
          [pid]: {
            place: {
              ...rest,
              id: pid,
              name: name ?? `${src.place.name} (branch)`,
              buildingIds: ids,
              lineage: {
                from: placeId,
                at: new Date(now).toISOString().slice(0, 10) as `${number}-${number}-${number}`,
              },
            },
            updatedAt: now,
            visitedAt: now,
            lineage: { from: placeId, at: now },
            area: src.area,
          },
        },
        buildings: { ...st.buildings, ...buildings },
      }));
      return pid;
    },

    removePlace(placeId) {
      set((s) => {
        const p = s.places[placeId];
        if (!p) return {};
        const places = { ...s.places };
        delete places[placeId];
        const buildings = { ...s.buildings };
        for (const b of p.place.buildingIds) delete buildings[b];
        return { places, buildings };
      });
    },

    visit(placeId) {
      const p = get().places[placeId];
      if (!p) return undefined;
      const days = p.visitedAt ? Math.floor((Date.now() - p.visitedAt) / 86_400_000) : 0;
      set((s) => ({ places: { ...s.places, [placeId]: { ...p, visitedAt: Date.now() } } }));
      if (days < 1) return undefined;
      // What changed since the last visit (SPEC 18.2). In V-P the pack history is Preview data.
      const r: Revisit = {
        placeId,
        daysAway: days,
        before: { ...get().settings, 'money.tariff.elec.rate': 7.3 },
        changes: [
          {
            kind: 'price',
            what: 'Electricity tariff, HT commercial',
            before: 'FY 2025-26',
            after: 'FY 2026-27',
            source: 'Telangana electricity regulator',
            short: 'new tariff',
          },
          {
            kind: 'code',
            what: 'Energy code edition',
            before: 'ECBC 2017',
            after: 'ECSBC 2024 tiers added',
            source: 'BEE notification',
            short: 'energy code tiers',
          },
          {
            kind: 'weather',
            what: 'Weather file',
            before: 'Typical weather from 2015 data',
            after: 'Typical weather from 2025 data',
            source: 'Indian typical weather data',
            short: 'new weather file',
          },
          {
            kind: 'pack',
            what: 'Hyderabad map data',
            before: 'Footprints only',
            after: 'Open Buildings heights added',
            source: 'Google Open Buildings heights',
            short: 'city heights',
          },
        ],
      };
      set({ revisit: r });
      return r;
    },

    dismissRevisit() {
      set((s) => (s.revisit ? { revisit: { ...s.revisit, dismissed: true } } : {}));
    },

    editDoc(buildingId, label, recipe, origin = 'person') {
      const b = get().buildings[buildingId];
      if (!b) return;
      const { doc, cmd } = edit(b.doc, label, recipe, origin);
      if (!cmd) return;
      putBuilding({ ...b, doc, history: record(b.history, cmd) });
      // Stale at once, recompute after a short pause (debounced compile on release).
      for (const v of b.variants) markStale(jobKey(b.id, v.id), downstreamStages(['geometry']));
      if (runTimer) clearTimeout(runTimer);
      runTimer = setTimeout(() => get().runBuilding(buildingId, ['geometry']), 450);
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(() => snapshot(buildingId, cmd), 1800);
    },

    undo(buildingId) {
      const b = get().buildings[buildingId];
      if (!b) return;
      const r = undo(b.history, b.doc);
      if (!r) return;
      putBuilding({ ...b, doc: r.doc, history: r.history });
      get().runBuilding(buildingId, ['geometry']);
    },

    redo(buildingId) {
      const b = get().buildings[buildingId];
      if (!b) return;
      const r = redo(b.history, b.doc);
      if (!r) return;
      putBuilding({ ...b, doc: r.doc, history: r.history });
      get().runBuilding(buildingId, ['geometry']);
    },

    restoreVersion(buildingId, versionId) {
      const b = get().buildings[buildingId];
      const v = b?.versions.find((x) => x.id === versionId);
      if (!b || !v) return;
      get().editDoc(buildingId, `Back to "${v.label}"`, (d) => {
        d.storeys = structuredClone(v.doc.storeys);
        d.rotationMdeg = v.doc.rotationMdeg;
        d.roofs = structuredClone(v.doc.roofs);
      });
    },

    saveVersion(buildingId, label) {
      const b = get().buildings[buildingId];
      if (!b) return;
      const euiMid = get().jobs[jobKey(buildingId, BASE_VARIANT)]?.views.energy?.euiMid;
      putBuilding({
        ...b,
        versions: [
          ...b.versions,
          {
            id: newId('v'),
            label,
            at: Date.now(),
            doc: b.doc,
            origin: 'person' as const,
            ...(euiMid ? { euiMid } : {}),
          },
        ].slice(-16),
      });
    },

    addVariant(buildingId, name, changes = {}) {
      const b = get().buildings[buildingId];
      if (!b) return BASE_VARIANT;
      if (b.variants.length >= 4) return b.variants[b.variants.length - 1]?.id ?? BASE_VARIANT;
      const id = newId('va');
      const n = b.variants.length;
      putBuilding({
        ...b,
        variants: [...b.variants, { id, name: name ?? `What if ${'ABC'[n - 1] ?? n}`, changes }],
        focus: id,
      });
      get().run(buildingId, id);
      return id;
    },

    removeVariant(buildingId, variantId) {
      const b = get().buildings[buildingId];
      if (!b || variantId === BASE_VARIANT) return;
      get().cancel(buildingId, variantId);
      putBuilding({
        ...b,
        variants: b.variants.filter((v) => v.id !== variantId),
        focus: b.focus === variantId ? BASE_VARIANT : b.focus,
      });
    },

    setLever(buildingId, variantId, lever, value) {
      const b = get().buildings[buildingId];
      if (!b) return;
      const variants = b.variants.map((v) => {
        if (v.id !== variantId) return v;
        const changes = { ...v.changes };
        if (value === BASE_LEVERS[lever]) delete changes[lever];
        else changes[lever] = value;
        return { ...v, changes };
      });
      putBuilding({ ...b, variants });
      const spec = LEVERS.find((l) => l.id === lever);
      get().run(buildingId, variantId, [spec?.stage ?? 'geometry']);
    },

    setFocus(buildingId, variantId) {
      const b = get().buildings[buildingId];
      if (b) putBuilding({ ...b, focus: variantId });
    },

    applyVariant(buildingId, changes, name) {
      return get().addVariant(buildingId, name, changes);
    },

    setSetting(id, value) {
      set((s) => ({ settings: { ...s.settings, [id]: value }, userSet: { ...s.userSet, [id]: true } }));
      const spec = SETTING_BY_ID.get(id);
      if (!spec?.stage) return;
      for (const b of Object.values(get().buildings)) {
        for (const v of b.variants) markStale(jobKey(b.id, v.id), downstreamStages([spec.stage]));
      }
      if (runTimer) clearTimeout(runTimer);
      const stage = spec.stage;
      runTimer = setTimeout(() => {
        for (const b of Object.values(get().buildings))
          if (get().jobs[jobKey(b.id, BASE_VARIANT)]) get().runBuilding(b.id, [stage]);
      }, 350);
    },

    resetSetting(id) {
      const spec = SETTING_BY_ID.get(id);
      if (!spec) return;
      get().setSetting(id, spec.value);
      set((s) => {
        const u = { ...s.userSet };
        delete u[id];
        return { userSet: u };
      });
    },

    run(buildingId, variantId, changed = ['geometry']) {
      const s = get();
      const b = s.buildings[buildingId];
      const v = b?.variants.find((x) => x.id === variantId);
      if (!b || !v) return;
      const key = jobKey(buildingId, variantId);
      const old = s.jobs[key];
      old?.handle?.cancel();
      const generation = (old?.generation ?? 0) + 1;
      // A stage with no output yet must run even if its inputs did not change.
      const needed = old ? downstreamStages(changed) : [...STUDIO_STAGES];
      const missing = STUDIO_STAGES.filter((st) => !old?.views[st]);
      const stages = STUDIO_STAGES.filter((st) => needed.includes(st) || missing.includes(st));
      const jobId = newId('job');
      const job: Job = {
        key,
        generation,
        bar: {
          jobId,
          generation,
          stages: STUDIO_STAGES.map((id) => ({
            id,
            status: stages.includes(id) ? 'queued' : old?.views[id] ? 'skipped' : 'idle',
            fraction: 0,
            preview: STAGE_PROVIDERS[id].startsWith('preview.'),
          })),
        },
        views: old?.views ?? {},
        nodes: old?.nodes ?? {},
        tiers: old?.tiers ?? {},
        stale: Object.fromEntries(stages.map((st) => [st, Boolean(old?.views[st])])),
        resolution: String(s.settings['analysis.resolution']) as ResolutionLevel,
        outputs: old?.outputs ?? {},
        latest: old?.latest ?? old?.outputs ?? {},
      };
      const factor = variantId === b.focus ? s.deviceFactor : s.deviceFactor * 0.5;
      const inputs = inputsFor(s, b, v, old?.outputs ?? {});
      job.withTiles = inputs.tiles.length > 0 || old?.withTiles === true;
      job.handle = startJob(
        jobId,
        generation,
        stages,
        inputs,
        onEvent(key),
        factor,
      );
      set((st) => ({ jobs: { ...st.jobs, [key]: job } }));
      job.handle.done.then((end) => {
        if (end.status === 'cancelled') {
          patchJob(key, (j) =>
            j.generation !== generation
              ? j
              : {
                  ...j,
                  message: 'Cancelled. Earlier results stay, marked as out of date.',
                  bar: {
                    ...j.bar,
                    stages: j.bar.stages.map((x) =>
                      x.status === 'running' || x.status === 'queued'
                        ? { ...x, status: j.views[x.id] ? 'stale' : 'cancelled' }
                        : x,
                    ),
                  },
                },
          );
        } else if (end.status === 'done') {
          patchJob(key, (j) => (j.generation !== generation ? j : { ...j, message: undefined }));
        }
      });
    },

    runBuilding(buildingId, changed = ['geometry']) {
      const b = get().buildings[buildingId];
      if (!b) return;
      // The building as it is first (compare reads against it), then the focused what-if, then the rest.
      const order = [BASE_VARIANT, b.focus, ...b.variants.map((v) => v.id)].filter(
        (id, i, a) => a.indexOf(id) === i,
      );
      for (const id of order) if (b.variants.some((v) => v.id === id)) get().run(buildingId, id, changed);
    },

    cancel(buildingId, variantId) {
      get().jobs[jobKey(buildingId, variantId)]?.handle?.cancel();
    },
  };

  function markStale(key: string, stages: StageId[]) {
    patchJob(key, (j) => ({
      ...j,
      stale: {
        ...j.stale,
        ...Object.fromEntries(stages.filter((st) => j.views[st]).map((st) => [st, true])),
      },
      bar: {
        ...j.bar,
        stages: j.bar.stages.map((x) =>
          stages.includes(x.id) && j.views[x.id] && x.status !== 'running' ? { ...x, status: 'stale' } : x,
        ),
      },
    }));
  }

  function snapshot(buildingId: string, cmd: EditCommand) {
    const b = get().buildings[buildingId];
    if (!b) return;
    const versions: Version[] = [
      ...b.versions,
      { id: newId('v'), label: cmd.label, at: Date.now(), doc: b.doc, origin: cmd.origin },
    ].slice(-16);
    putBuilding({ ...b, versions });
  }
});
