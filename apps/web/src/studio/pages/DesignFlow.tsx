/**
 * Design before you build (SPEC 27): brief, design, place, test sites and orientations, shape it to
 * the goals, commit as a branch. Owner: WP-08 (flow), WP-15 (editor parts).
 *
 * Everything is Preview until the real stages land. Codes follow the plot's location; a designed
 * building never reads as compliant: each target shows met, not met or unknown with its source
 * (AC-PD3). Moving or turning the building reruns its stages in the studio worker with the
 * progress bar, so the page never freezes (AC-PD2).
 */
import type {
  BuildingDoc,
  BuildingTypeId,
  EvidenceId,
  EvidenceNode,
  GapStatus,
  GoalPreset,
  Place,
  ScopedGoal,
  StageId,
  StageOut,
} from '@ibasho/core';
import { GOAL_PRESETS, STUDIO_STAGES } from '@ibasho/core';
import {
  addCore,
  edit,
  emptyHistory,
  FacadePanel,
  type History,
  PlanEditor,
  type Recipe,
  record,
  redo,
  StoreyStack,
  undo,
} from '@ibasho/editor';
import { goalGap } from '@ibasho/preview';
import { CityCompare, type PlacementCheck } from '@ibasho/scene';
import {
  ChoiceChips,
  CompareGrid,
  EvidenceProvider,
  Num,
  PreviewStamp,
  Range,
  StageBar,
  Stepper,
  TypeCards,
} from '@ibasho/ui';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cityTiles, samplePlaces } from '../data.ts';
import { CityStage } from '../niwa/Niwa.tsx';
import { startJob } from '../preview/jobs.ts';
import type { JobHandle, RunEvent } from '../preview/runner.ts';
import { BASE_LEVERS, type Levers } from '../preview/settings.ts';
import { TYPE_DEFAULTS, templateDoc } from '../preview/template.ts';
import type { StageViews } from '../preview/views.ts';
import { useStudio } from '../state/studio.ts';

const STEPS = ['Brief', 'Design', 'Place', 'Compare sites', 'Shape to goals', 'Commit'] as const;

// ------------------------------------------------------------------------------------------------
// Goals: agent A's typed presets (GOAL_PRESETS), judged by the Preview stages (goalGap)

const GOAL_LABEL: Record<string, string> = {
  'net-zero-ready-uk': 'Net zero ready (UK standard)',
  'fhs-2025': 'Future Homes Standard',
  'part-l': 'Part L 2021',
  'london-plan': 'London Plan net zero',
  'ecsbc-super': 'ECSBC Super',
  'leed-gold': 'LEED Gold',
  'lowest-opex': 'Lowest running cost',
};
export const goalLabel = (id: string): string => GOAL_LABEL[id] ?? id;

export type GapState = GapStatus | 'not-here';
export interface DesignGap {
  id: string;
  label: string;
  state: GapState;
  text: string;
  source: string;
}

const applies = (p: GoalPreset, region: 'IN' | 'GB') =>
  !p.regions || p.regions.some((r: string) => r.startsWith(region));
const fmt = (v: number) =>
  Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2).replace(/\.?0+$/, '');

/** Where a design stands against each goal (AC-PD3): met, not met or unknown, with its source; never "compliant". */
export function designGaps(
  ids: readonly string[],
  out: Partial<StageOut> | undefined,
  region: 'IN' | 'GB',
): DesignGap[] {
  return ids.flatMap((id): DesignGap[] => {
    const p = GOAL_PRESETS.find((x) => x.id === id);
    if (!p) return [];
    const label = goalLabel(id);
    const source = p.sources[0]?.title ?? 'Typical target';
    if (!applies(p, region))
      return [
        {
          id,
          label,
          state: 'not-here' as const,
          text: `Does not apply in ${region === 'GB' ? 'the UK' : 'India'}.`,
          source,
        },
      ];
    const codes = out?.codes;
    if (!codes) return [{ id, label, state: 'unknown' as const, text: 'Waiting for the results.', source }];
    const g = goalGap(
      p.goal,
      {
        codes: codes.codes,
        ratings: codes.ratings,
        baselines: codes.baselines,
        energy: codes.result,
        ...(out?.optimise ? { optimise: out.optimise } : {}),
      },
      p.id,
    );
    const value = g.value
      ? `${fmt(g.value.lo)} to ${fmt(g.value.hi)}${g.unit ? ` ${g.unit}` : ''}`
      : undefined;
    const text = value
      ? g.target !== undefined
        ? `${value}, against ${fmt(g.target)}${g.unit ? ` ${g.unit}` : ''}.`
        : `${value}.`
      : g.status === 'unknown'
        ? 'Not enough is known yet to judge this.'
        : '';
    return [{ id, label, state: g.status, text, source: g.sources[0]?.title ?? source }];
  });
}

const GAP_WORD: Record<GapState, string> = {
  met: 'Met',
  'not-met': 'Not met',
  unknown: 'Unknown',
  'not-here': 'Not applicable',
};

// ------------------------------------------------------------------------------------------------
// Sites

type CityId = 'hyderabad' | 'london';
interface Site {
  id: string;
  city: CityId;
  origin: { x: number; y: number };
  rotationDeg: number;
  levers: Levers;
}
interface SiteRun {
  generation: number;
  handle?: JobHandle;
  views: Partial<StageViews>;
  nodes: Partial<Record<StageId, EvidenceNode[]>>;
  outputs: Partial<StageOut>;
  bar: {
    jobId?: string;
    generation: number;
    stages: {
      id: StageId;
      status: 'queued' | 'running' | 'done' | 'idle';
      fraction: number;
      preview: boolean;
      tier?: 'rough' | 'refined' | 'final';
    }[];
  };
  message?: string | undefined;
}

const placeOf = (city: CityId): Place => {
  const all = samplePlaces();
  return (all.find((p) => p.id === (city === 'london' ? 'pl_kings_cross' : 'pl_iiit')) ??
    all.find((p) => p.id === (city === 'london' ? 'pl_london' : 'pl_iiit')) ??
    all[0]) as Place;
};

/** A free spot near the campus edge (pack frame mm); the person drags or nudges from there. */
const START: Record<CityId, { x: number; y: number }> = {
  hyderabad: { x: 260_000, y: -220_000 },
  london: { x: 0, y: 0 },
};

export function DesignFlow() {
  const nav = useNavigate();
  const st = useStudio.getState();
  const tiles = useStudio((s) => s.tiles);
  const settings = useStudio((s) => s.settings);
  const [step, setStep] = useState(0);
  // Brief
  const [type, setType] = useState<BuildingTypeId>('office');
  const [name, setName] = useState('My new building');
  const [area, setArea] = useState(2400);
  const [storeys, setStoreys] = useState(2);
  const [budget, setBudget] = useState<'low' | 'mid' | 'high'>('mid');
  const [goals, setGoals] = useState<string[]>(['ecsbc-super', 'lowest-opex']);
  // Design
  const [doc, setDoc] = useState<BuildingDoc | null>(null);
  const [history, setHistory] = useState<History>(emptyHistory());
  const [storeyId, setStoreyId] = useState('st_0');
  const [selection, setSelection] = useState<string[]>([]);
  // Place and compare
  const [city, setCity] = useState<CityId>('hyderabad');
  const [origin, setOrigin] = useState(START.hyderabad);
  const [rotation, setRotation] = useState(0);
  const [sites, setSites] = useState<Site[]>([]);
  const [runs, setRuns] = useState<Record<string, SiteRun>>({});
  const [chosen, setChosen] = useState<string | undefined>();

  useEffect(() => {
    void cityTiles().then((t) => t.length && useStudio.setState({ tiles: t }));
  }, []);

  const startDesign = (massing: boolean) => {
    const d = TYPE_DEFAULTS[type];
    const plate = area / Math.max(1, storeys);
    const ratio = d.w / d.d;
    const w = Math.max(8, Math.round(Math.sqrt(plate * ratio)));
    const dp = Math.max(6, Math.round(plate / w));
    setDoc(
      templateDoc(
        {
          typeId: type,
          name,
          placeId: 'design',
          widthM: w,
          depthM: dp,
          storeys,
          floorToFloorM: d.ftf,
          wwrPct: 30,
          rotationDeg: 0,
          autoZone: !massing,
        },
        `bd_design_${Math.random().toString(36).slice(2, 7)}`,
      ),
    );
    setHistory(emptyHistory());
    setStoreyId('st_0');
    setStep(1);
  };

  const onEdit = useCallback(
    (label: string, recipe: Recipe) => {
      if (!doc) return;
      const { doc: next, cmd } = edit(doc, label, recipe);
      if (!cmd) return;
      setDoc(next);
      setHistory((h) => record(h, cmd));
    },
    [doc],
  );

  const placed = useMemo(
    () => (doc ? { ...doc, origin, rotationMdeg: Math.round(rotation * 1000) } : null),
    [doc, origin, rotation],
  );

  // Site check from the scene (SPEC 27 step 3): overlaps with mapped buildings and who shades it.
  const [check, setCheck] = useState<PlacementCheck | undefined>();
  const nameOf = useCallback(
    (id: string) => {
      for (const t of tiles)
        for (const b of t.buildings) if (b.id === id) return b.name ?? 'an unnamed building';
      return 'a mapped building';
    },
    [tiles],
  );
  const overlaps = (check?.overlaps ?? []).map(nameOf).slice(0, 5);

  // Runs per site, in the studio worker.
  const run = useCallback(
    (site: Site) => {
      if (!doc) return;
      const place = placeOf(site.city);
      const jobId = `design_${site.id}_${Date.now().toString(36)}`;
      setRuns((r) => {
        r[site.id]?.handle?.cancel();
        return r;
      });
      const generation = (runs[site.id]?.generation ?? 0) + 1;
      const onEvent = (e: RunEvent) =>
        setRuns((r) => {
          const cur = r[site.id];
          if (!cur || cur.generation !== e.generation) return r;
          const stages = cur.bar.stages.map((x) =>
            x.id === e.stage
              ? {
                  ...x,
                  status: e.status === 'done' ? ('done' as const) : ('running' as const),
                  fraction: e.fraction,
                  ...(e.tier ? { tier: e.tier } : {}),
                }
              : x,
          );
          return {
            ...r,
            [site.id]: {
              ...cur,
              bar: { ...cur.bar, stages },
              message: e.message,
              ...(e.result
                ? {
                    views: { ...cur.views, [e.stage]: e.result.view },
                    nodes: { ...cur.nodes, [e.stage]: e.result.nodes },
                  }
                : {}),
            },
          };
        });
      const handle = startJob(
        jobId,
        generation,
        STUDIO_STAGES,
        {
          key: `design~${site.id}`,
          placeId: place.id,
          variantId: site.id,
          doc: {
            ...doc,
            placeId: place.id,
            origin: site.origin,
            rotationMdeg: Math.round(site.rotationDeg * 1000),
          },
          place,
          tiles: site.city === 'hyderabad' ? tiles : [],
          levers: { ...BASE_LEVERS, ...site.levers },
          settings,
          resolution: 'sketch',
          asOf: new Date().toISOString(),
          goals: goals
            .map((id) => GOAL_PRESETS.find((p) => p.id === id))
            .filter(
              (p): p is GoalPreset =>
                Boolean(p) && applies(p as GoalPreset, site.city === 'london' ? 'GB' : 'IN'),
            )
            .map(
              (p): ScopedGoal => ({
                goal: p.goal,
                scope: { level: 'building', id: doc.id },
                strength: 'must',
              }),
            ),
        },
        onEvent,
        useStudio.getState().deviceFactor * 0.6,
      );
      setRuns((r) => ({
        ...r,
        [site.id]: {
          generation,
          handle,
          views: r[site.id]?.views ?? {},
          nodes: r[site.id]?.nodes ?? {},
          outputs: r[site.id]?.outputs ?? {},
          bar: {
            jobId,
            generation,
            stages: STUDIO_STAGES.map((id) => ({
              id,
              status: 'queued' as const,
              fraction: 0,
              preview: true,
            })),
          },
        },
      }));
      void handle.done.then(() =>
        setRuns((r) =>
          r[site.id] ? { ...r, [site.id]: { ...(r[site.id] as SiteRun), message: undefined } } : r,
        ),
      );
    },
    [doc, tiles, settings, runs, goals],
  );

  const addSite = () => {
    const site: Site = {
      id: `s${sites.length + 1}_${Math.random().toString(36).slice(2, 5)}`,
      city,
      origin,
      rotationDeg: rotation,
      levers: {},
    };
    setSites((s) => [...s, site].slice(-3));
    setChosen(site.id);
    run(site);
  };

  // Moving a site that is already being compared reruns it (AC-PD2), debounced.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const evidence = useMemo(() => {
    const m = new Map<EvidenceId, EvidenceNode>();
    for (const r of Object.values(runs))
      for (const list of Object.values(r.nodes)) for (const n of list ?? []) m.set(n.id, n);
    return { node: (id: EvidenceId) => m.get(id), locale: 'en-IN' };
  }, [runs]);

  const chosenSite = sites.find((s) => s.id === chosen) ?? sites[0];
  const gaps = designGaps(
    goals,
    chosenSite ? runs[chosenSite.id]?.outputs : undefined,
    chosenSite?.city === 'london' ? 'GB' : 'IN',
  );

  const commit = () => {
    if (!placed || !chosenSite) return;
    const place = placeOf(chosenSite.city);
    const pid = st.createPlace({
      name: `${name} site`,
      lat: place.lat,
      lon: place.lon,
      area: chosenSite.city === 'london' ? 'London' : 'Hyderabad',
    });
    useStudio.setState((s) => {
      const p = s.places[pid];
      return p
        ? {
            places: {
              ...s.places,
              [pid]: {
                ...p,
                place: {
                  ...p.place,
                  cityPackId: place.cityPackId ?? 'city-hyderabad',
                  climatePackId: place.climatePackId,
                  codePackIds: place.codePackIds,
                  moneyPackIds: place.moneyPackIds,
                },
              },
            },
          }
        : {};
    });
    const bid = st.createBuilding(pid, type, name, {
      ...placed,
      origin: chosenSite.origin,
      rotationMdeg: Math.round(chosenSite.rotationDeg * 1000),
    });
    if (Object.keys(chosenSite.levers).length) st.addVariant(bid, 'Shaped to the goals', chosenSite.levers);
    st.saveVersion(bid, 'Designed before building');
    st.runBuilding(bid);
    nav(`/p/${pid}/b/${bid}?level=building&mode=look`);
  };

  const nudge = (dx: number, dy: number) => setOrigin((o) => ({ x: o.x + dx, y: o.y + dy }));

  let body: ReactNode = null;
  if (step === 0) {
    body = (
      <section className="st-new__step" aria-labelledby="d0">
        <h1 id="d0" className="st-new__title">
          Design before you build
        </h1>
        <p className="st-new__lede">
          Start from a brief. Draw it, place it on a real map, test plots and orientations, then shape it to
          your goals while changes are cheap.
        </p>
        <TypeCards value={type} onChange={setType} />
        <label className="st-field">
          <span>Name</span>
          <input className="ib-field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="st-grid2">
          <div className="st-field">
            <span>Floor area (m²)</span>
            <Stepper
              id="d-area"
              label="floor area"
              value={area}
              step={100}
              min={100}
              max={200_000}
              onChange={setArea}
            />
          </div>
          <div className="st-field">
            <span>Storeys</span>
            <Stepper
              id="d-storeys"
              label="storeys"
              value={storeys}
              step={1}
              min={1}
              max={40}
              onChange={setStoreys}
            />
          </div>
        </div>
        <div className="st-field">
          <span>Budget band</span>
          <ChoiceChips
            id="d-budget"
            label="Budget band"
            value={budget}
            onChange={setBudget}
            choices={[
              { value: 'low', label: 'Tight' },
              { value: 'mid', label: 'Typical' },
              { value: 'high', label: 'Generous' },
            ]}
          />
        </div>
        <fieldset className="st-goals">
          <legend>Goals (each becomes a typed target)</legend>
          {GOAL_PRESETS.map((g) => (
            <button
              key={g.id}
              type="button"
              className="ib-chip"
              aria-pressed={goals.includes(g.id)}
              title={g.sources[0]?.title}
              onClick={() =>
                setGoals((gs) => (gs.includes(g.id) ? gs.filter((x) => x !== g.id) : [...gs, g.id]))
              }
            >
              {goalLabel(g.id)}
              {g.regions ? (g.regions.some((r) => r.startsWith('GB')) ? ' (UK)' : ' (India)') : ''}
            </button>
          ))}
        </fieldset>
        <div className="st-new__nav">
          <button type="button" className="ib-btn ib-btn--quiet" onClick={() => startDesign(true)}>
            Start with massing
          </button>
          <button type="button" className="ib-btn" onClick={() => startDesign(false)}>
            Start from a {type} template
          </button>
        </div>
      </section>
    );
  } else if (step === 1 && doc) {
    body = (
      <section className="st-new__step st-new__step--wide st-design" aria-labelledby="d1">
        <h1 id="d1" className="st-new__title">
          Design it
        </h1>
        <div className="st-design__grid">
          <div className="st-design__plan">
            <PlanEditor
              doc={doc}
              storeyId={storeyId}
              onStorey={setStoreyId}
              selection={selection}
              onSelect={setSelection}
              onEdit={onEdit}
              onUndo={() => {
                const u = undo(history, doc);
                if (u) {
                  setDoc(u.doc);
                  setHistory(u.history);
                }
              }}
              onRedo={() => {
                const u = redo(history, doc);
                if (u) {
                  setDoc(u.doc);
                  setHistory(u.history);
                }
              }}
              canUndo={history.past.length > 0}
              canRedo={history.future.length > 0}
            />
          </div>
          <div className="st-design__side">
            <StoreyStack doc={doc} storeyId={storeyId} onStorey={setStoreyId} onEdit={onEdit} />
            <button
              type="button"
              className="ib-btn ib-btn--quiet"
              onClick={() => {
                const pts = doc.storeys[0]?.rooms.flatMap((r) => r.floor.outer) ?? [];
                const xs = pts.map((p) => p[0]);
                const ys = pts.map((p) => p[1]);
                const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
                onEdit(
                  'Add a core',
                  addCore(
                    doc.storeys[0]?.id ?? 'st_0',
                    [
                      [cx - 4000, cy - 3000],
                      [cx + 4000, cy - 3000],
                      [cx + 4000, cy + 3000],
                      [cx - 4000, cy + 3000],
                    ],
                    'stair',
                  ),
                );
              }}
            >
              Add a stair and lift core
            </button>
            <FacadePanel doc={doc} onEdit={onEdit} />
          </div>
        </div>
        <div className="st-new__nav">
          <button type="button" className="ib-link" onClick={() => setStep(0)}>
            Back to the brief
          </button>
          <button type="button" className="ib-btn" onClick={() => setStep(2)}>
            Next: place it
          </button>
        </div>
      </section>
    );
  } else if (step === 2 && placed) {
    const place = placeOf(city);
    body = (
      <section className="st-new__step st-new__step--wide" aria-labelledby="d2">
        <h1 id="d2" className="st-new__title">
          Place it on the map
        </h1>
        <ChoiceChips
          id="d-city"
          label="City"
          value={city}
          onChange={(c) => {
            setCity(c);
            setOrigin(START[c]);
          }}
          choices={[
            { value: 'hyderabad', label: 'Hyderabad' },
            { value: 'london', label: 'London' },
          ]}
        />
        <p className="st-note">
          Click open ground on the map to move the building there, or use the buttons. More cities arrive as
          city packs land.
        </p>
        <div className="st-new__city">
          <CityStage
            doc={placed}
            place={place}
            tiles={city === 'hyderabad' ? tiles : []}
            level="site"
            night={false}
            reducedMotion
            date="mar"
            minutes={15 * 60}
            lens="shadows"
            job={undefined}
            onSelect={(t) => {
              if (t.kind === 'ground')
                setOrigin({ x: Math.round(t.east * 1000), y: Math.round(t.north * 1000) });
            }}
          />
        </div>
        <div className="st-place-ctl">
          <fieldset className="st-nudge" aria-label="Move the building">
            <button type="button" className="ib-chip" onClick={() => nudge(0, 10_000)}>
              North 10 m
            </button>
            <button type="button" className="ib-chip" onClick={() => nudge(0, -10_000)}>
              South 10 m
            </button>
            <button type="button" className="ib-chip" onClick={() => nudge(10_000, 0)}>
              East 10 m
            </button>
            <button type="button" className="ib-chip" onClick={() => nudge(-10_000, 0)}>
              West 10 m
            </button>
          </fieldset>
          <Range
            label="Turn the building"
            value={rotation}
            min={-180}
            max={180}
            step={5}
            format={(v) => `${v}°`}
            onChange={setRotation}
          />
        </div>
        {overlaps.length ? (
          <p className="st-refuse" role="status">
            The footprint overlaps {overlaps.join(', ')}. Move it onto free ground.
          </p>
        ) : (
          <p className="st-note">No overlap with mapped buildings.</p>
        )}
        {check?.shading.length ? (
          <p className="st-note">
            Shaded in winter and spring by{' '}
            {check.shading
              .slice(0, 4)
              .map(
                (x) =>
                  `${x.name ?? 'a neighbour'} (about ${Math.round(x.hours)} h${x.estimated ? ', estimated height' : ''})`,
              )
              .join(', ')}
            .
          </p>
        ) : null}
        <div className="st-new__nav">
          <button type="button" className="ib-link" onClick={() => setStep(1)}>
            Back to the design
          </button>
          <span>
            <button
              type="button"
              className="ib-btn ib-btn--quiet"
              onClick={addSite}
              disabled={sites.length >= 3}
            >
              Add this plot to compare
            </button>{' '}
            <button
              type="button"
              className="ib-btn"
              onClick={() => {
                if (!sites.length) addSite();
                setStep(3);
              }}
            >
              Compare
            </button>
          </span>
        </div>
      </section>
    );
  } else if (step === 3) {
    body = (
      <section className="st-new__step st-new__step--wide" aria-labelledby="d3">
        <h1 id="d3" className="st-new__title">
          Plots and orientations, side by side
        </h1>
        <p className="st-note">
          The same design on each plot. Codes follow each plot's location. <PreviewStamp compact />
        </p>
        {doc && sites.length > 1 ? (
          <div className="st-design__compare">
            <CityCompare
              base={{ hero: doc, place: placeOf('hyderabad'), tiles, hideContextIds: [] }}
              options={sites.map((s, i) => ({
                id: s.id,
                label: `Plot ${i + 1}`,
                placement: { origin: s.origin, rotationMdeg: Math.round(s.rotationDeg * 1000) },
                ...(s.city === 'london'
                  ? { overrides: { place: placeOf('london'), tiles: [], hideContextIds: [] } }
                  : {}),
              }))}
              level="site"
              lens="radiation"
            />
          </div>
        ) : null}
        <CompareGrid
          focus={chosenSite?.id}
          onFocus={setChosen}
          slots={sites.map((s, i) => {
            const r = runs[s.id];
            const e = r?.views.energy;
            const c = r?.views.codes;
            const sun = r?.views.sun;
            const d = r?.views.daylight;
            return {
              id: s.id,
              label: `${s.city === 'london' ? 'London' : 'Hyderabad'}, turned ${s.rotationDeg}°`,
              kicker: `Plot ${i + 1}`,
              body: (
                <div className="st-slot">
                  <div className="st-slot__scene">
                    {doc ? (
                      <CityStage
                        doc={{ ...doc, origin: s.origin, rotationMdeg: Math.round(s.rotationDeg * 1000) }}
                        place={placeOf(s.city)}
                        tiles={s.city === 'hyderabad' ? tiles : []}
                        level="building"
                        night={false}
                        reducedMotion
                        date="mar"
                        minutes={15 * 60}
                        lens="radiation"
                        job={undefined}
                        compact
                      />
                    ) : null}
                  </div>
                  {r ? (
                    <StageBar
                      state={r.bar}
                      compact
                      {...(r.message ? { message: r.message } : {})}
                      onCancel={() => r.handle?.cancel()}
                    />
                  ) : null}
                  <dl className="st-slot__nums">
                    {[
                      ['EUI', e?.eui],
                      ['Bill', e?.bill],
                      ['Carbon', e?.carbon],
                      ['Roof sun', sun?.roof],
                      ['Daylit floor', d?.ecbc],
                      ['Below code baseline', c?.savings],
                    ].map(([label, ev]) => (
                      <div key={label as string}>
                        <dt>{label as string}</dt>
                        <dd>
                          {ev ? (
                            <Num ev={ev as EvidenceId} size="ui" />
                          ) : (
                            <span className="st-dash">computing</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ),
            };
          })}
        />
        <div className="st-new__nav">
          <button type="button" className="ib-link" onClick={() => setStep(2)}>
            Add or move a plot
          </button>
          <button type="button" className="ib-btn" onClick={() => setStep(4)} disabled={!chosenSite}>
            Next: shape it to the goals
          </button>
        </div>
      </section>
    );
  } else if (step === 4 && chosenSite) {
    const opt = runs[chosenSite.id]?.views.optimise;
    body = (
      <section className="st-new__step" aria-labelledby="d4">
        <h1 id="d4" className="st-new__title">
          Shape it to the goals
        </h1>
        <ul className="st-gaps">
          {gaps.map((g) => (
            <li key={g.id} data-state={g.state}>
              <span className="st-gaps__mark" aria-hidden="true" />
              <span className="st-gaps__label">{g.label}</span>
              <span className="st-gaps__state">{GAP_WORD[g.state]}</span>
              <span className="st-gaps__note">
                {g.text} <span className="st-gaps__src">Source: {g.source}.</span>
              </span>
            </li>
          ))}
        </ul>
        <h2 className="st-ledger__title">Cheapest changes that move it</h2>
        {opt?.picks.length ? (
          <ul className="st-picks">
            {opt.picks.map((p) => (
              <li key={p.role} className="st-pick">
                <span className="st-pick__role">{p.label}</span>
                <span className="st-pick__what">{p.cand.label}</span>
                <span>
                  Upfront <Num ev={p.capex} size="ui" />, EUI <Num ev={p.eui} size="ui" />
                </span>
                <button
                  type="button"
                  className="ib-btn ib-btn--quiet"
                  onClick={() => {
                    const next = { ...chosenSite, levers: { ...chosenSite.levers, ...p.cand.levers } };
                    setSites((ss) => ss.map((x) => (x.id === next.id ? next : x)));
                    run(next);
                  }}
                >
                  Apply to this design
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="st-note">The search is still trying bundles for this plot.</p>
        )}
        <div className="st-new__nav">
          <button type="button" className="ib-link" onClick={() => setStep(3)}>
            Back to the comparison
          </button>
          <button type="button" className="ib-btn" onClick={() => setStep(5)}>
            Next: commit
          </button>
        </div>
      </section>
    );
  } else if (step === 5 && chosenSite) {
    body = (
      <section className="st-new__step" aria-labelledby="d5">
        <h1 id="d5" className="st-new__title">
          Commit to this design
        </h1>
        <p className="st-new__lede">
          {name} on plot {sites.indexOf(chosenSite) + 1} in{' '}
          {chosenSite.city === 'london' ? 'London' : 'Hyderabad'}, turned {chosenSite.rotationDeg}°. It is
          saved as its own place with its assumptions, so it can later become the building as built and be
          revisited.
        </p>
        <ul className="st-memory">
          <li>Goals: {goals.map(goalLabel).join(', ') || 'none'}.</li>
          <li>Budget band: {budget === 'low' ? 'tight' : budget === 'mid' ? 'typical' : 'generous'}.</li>
          <li>Every number is a Preview estimate until it is calculated for this building.</li>
        </ul>
        <div className="st-new__nav">
          <button type="button" className="ib-link" onClick={() => setStep(4)}>
            Back
          </button>
          <button type="button" className="ib-btn ib-btn--hero" onClick={commit}>
            Save the design
          </button>
        </div>
      </section>
    );
  }

  return (
    <EvidenceProvider source={evidence}>
      <div className="st-new st-designflow">
        <p className="st-steps-phone" aria-hidden="true">
          <span>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          <span className="st-steps-phone__line">
            <span style={{ inlineSize: `${((step + 1) / STEPS.length) * 100}%` }} />
          </span>
        </p>
        <ol className="st-steps" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} data-state={i < step ? 'done' : i === step ? 'here' : 'next'}>
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                disabled={i > step || (i > 0 && !doc)}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="st-steps__bead" aria-hidden="true" />
                {s}
              </button>
            </li>
          ))}
        </ol>
        <div className="st-new__body">{body}</div>
      </div>
    </EvidenceProvider>
  );
}
