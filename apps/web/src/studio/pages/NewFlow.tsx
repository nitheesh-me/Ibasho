/**
 * New flow (SPEC 18.1, UV 5.1): place, type, building, rooms and openings, place in the city, see.
 * Owner: WP-08.
 *
 * Every defaulted field is visibly an estimate (AC-NW2). The first step can also find a building
 * that is already in the studio ("Find your building"), which jumps straight to it. Drawing from
 * scratch needs a tablet or a desktop; the phone offers templates and the sample.
 */
import type { BuildingTypeId, Place } from '@ibasho/core';
import { ChoiceChips, Stepper, TypeCards } from '@ibasho/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { IIIT_PLACE_ID, packsFor, sampleDoc, samplePlaces } from '../data.ts';
import { useBreakpoint } from '../hooks.ts';
import { CityStage } from '../niwa/Niwa.tsx';
import { TYPE_DEFAULTS, templateDoc } from '../preview/template.ts';
import { SearchBox } from '../search/Search.tsx';
import { useStudio } from '../state/studio.ts';

const PLACES = [
  { id: 'iiit', name: 'IIIT Hyderabad campus', area: 'Gachibowli, Hyderabad', lat: 17.4453, lon: 78.349 },
  { id: 'hitec', name: 'HITEC City', area: 'Madhapur, Hyderabad', lat: 17.4474, lon: 78.3762 },
  { id: 'gachi', name: 'Gachibowli flats', area: 'Gachibowli, Hyderabad', lat: 17.4401, lon: 78.3489 },
  { id: 'banjara', name: 'Banjara Hills', area: 'Hyderabad', lat: 17.4138, lon: 78.4398 },
  { id: 'london', name: 'A London street', area: 'London', lat: 51.5072, lon: -0.1276 },
] as const;

interface PlaceChoice {
  id: string;
  name: string;
  area: string;
  lat: number;
  lon: number;
  /** An on-demand place shipped with the app (its map area loads when picked). */
  sample?: true;
}

/** Places that load on demand: offices of interest in HITEC City, King's Cross in London. */
const MORE_PLACES: PlaceChoice[] = samplePlaces()
  .filter((p) => p.onDemand)
  .map((p) => ({
    id: p.id,
    name: p.name,
    area: p.lat > 40 ? 'London' : 'HITEC City, Hyderabad',
    lat: p.lat,
    lon: p.lon,
    sample: true as const,
  }));
const ALL_PLACES: PlaceChoice[] = [...PLACES, ...MORE_PLACES];

const STEPS = ['Place', 'Type', 'Building', 'Rooms and windows', 'Place it', 'See'] as const;

// Pack frame origin is the IIIT campus centre; a new building stands near its place, on open ground.
const originFor = (lat: number, lon: number, sample?: boolean) =>
  sample
    ? { x: 120_000, y: -90_000 }
    : {
        x: Math.round((lon - 78.349) * 111_320 * Math.cos((17.4453 * Math.PI) / 180) * 1000) + 260_000,
        y: Math.round((lat - 17.4453) * 110_540 * 1000) - 220_000,
      };

export function NewFlow() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const bp = useBreakpoint();
  const st = useStudio.getState();
  const existingPlace = useStudio((s) => (q.get('place') ? s.places[q.get('place') ?? ''] : undefined));
  const [step, setStep] = useState(existingPlace ? 1 : 0);
  const sampleHitec = q.get('sample') === 'hitec';
  const [placePick, setPlacePick] = useState<string>(sampleHitec ? 'hitec' : 'iiit');
  const [type, setType] = useState<BuildingTypeId | undefined>(
    (q.get('template') as BuildingTypeId | null) ?? undefined,
  );
  const [start, setStart] = useState<'template' | 'sample' | 'trace'>('template');
  const d = TYPE_DEFAULTS[type ?? 'office'];
  const [w, setW] = useState(d.w);
  const [dep, setDep] = useState(d.d);
  const [n, setN] = useState(d.n);
  const [ftf, setFtf] = useState(d.ftf);
  const [wwr, setWwr] = useState(30);
  const [zone, setZone] = useState<'auto' | 'one'>('auto');
  const [rot, setRot] = useState(0);
  const [name, setName] = useState(sampleHitec ? 'HITEC City office' : '');
  const [touched, setTouched] = useState<Record<string, true>>({});
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const pickType = (t: BuildingTypeId) => {
    setType(t);
    const td = TYPE_DEFAULTS[t];
    setW(td.w);
    setDep(td.d);
    setN(td.n);
    setFtf(td.ftf);
    setTouched({});
  };

  const areas = useStudio((s) => s.areas);
  const pick: PlaceChoice = ALL_PLACES.find((x) => x.id === placePick) ?? (PLACES[0] as PlaceChoice);
  const placeFor = (): Place =>
    existingPlace?.place ??
    (pick.sample ? samplePlaces().find((p) => p.id === pick.id) : undefined) ?? {
      id: 'preview',
      name: pick.name,
      lat: pick.lat,
      lon: pick.lon,
      elevationM: 0,
      trueNorthMdeg: 0,
      ...packsFor(pick.lat, pick.lon),
      buildingIds: [],
    };
  const pickPack = placeFor().cityPackId;
  useEffect(() => {
    useStudio.getState().ensureArea(pickPack);
  }, [pickPack]);
  const tiles = pickPack ? (areas[pickPack] ?? []) : [];
  const preview = useMemo(
    () =>
      start === 'sample'
        ? sampleDoc('gb1')
        : templateDoc(
            {
              typeId: type ?? 'office',
              name: name || 'New building',
              placeId: 'preview',
              widthM: w,
              depthM: dep,
              storeys: n,
              floorToFloorM: ftf,
              wwrPct: wwr,
              rotationDeg: rot,
              autoZone: zone === 'auto',
            },
            'bd_preview',
          ),
    [start, type, name, w, dep, n, ftf, wwr, rot, zone],
  );
  const placeLat = existingPlace?.place.lat ?? pick.lat;
  const placeLon = existingPlace?.place.lon ?? pick.lon;
  const placed = useMemo(
    () => (start === 'sample' ? preview : { ...preview, origin: originFor(placeLat, placeLon, pick.sample) }),
    [preview, start, placeLat, placeLon, pick.sample],
  );

  const finish = () => {
    let placeId = existingPlace?.place.id;
    if (!placeId) {
      const p = pick;
      placeId = p.sample
        ? (st.addSamplePlace(p.id), p.id)
        : p.id === 'iiit' && useStudio.getState().places[IIIT_PLACE_ID]
          ? IIIT_PLACE_ID
          : st.createPlace({ name: p.name, lat: p.lat, lon: p.lon, area: p.area });
    }
    const t = type ?? 'office';
    const doc =
      start === 'sample'
        ? { ...sampleDoc('gb1'), id: `bd_${Math.random().toString(36).slice(2, 8)}` }
        : placed;
    const bid = st.createBuilding(
      placeId,
      start === 'sample' ? 'education' : t,
      name || (start === 'sample' ? 'Vindhya Bhavan (copy)' : `New ${t}`),
      { ...doc, rotationMdeg: Math.round(rot * 1000) + (start === 'sample' ? doc.rotationMdeg : 0) },
    );
    nav(`/p/${placeId}/b/${bid}?level=building&mode=look&lens=radiation`);
  };

  const est = (k: string) => (touched[k] ? undefined : 'estimate');
  const canDraw = bp !== 'phone';

  return (
    <div className="st-new">
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
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
            >
              <span className="st-steps__bead" aria-hidden="true" />
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="st-new__body">
        {step === 0 ? (
          <section className="st-new__step" aria-labelledby="s0">
            <h1 id="s0" className="st-new__title">
              Where is it?
            </h1>
            <p className="st-new__lede">
              Find a building already in your studio, or pick a place. Hyderabad and London work offline.
            </p>
            <SearchBox placeholder="Find your building, floor or room" onPicked={(to) => nav(to)} />
            <fieldset className="st-places-pick" aria-label="Place">
              {PLACES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={placePick === p.id}
                  className="st-placecard"
                  onClick={() => setPlacePick(p.id)}
                >
                  <span className="st-placecard__name">{p.name}</span>
                  <span className="st-placecard__area">{p.area}</span>
                </button>
              ))}
            </fieldset>
            <details className="st-more" open={MORE_PLACES.some((m) => m.id === placePick)}>
              <summary>More places</summary>
              <fieldset className="st-places-pick" aria-label="More places">
                {MORE_PLACES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={placePick === p.id}
                    className="st-placecard"
                    onClick={() => setPlacePick(p.id)}
                  >
                    <span className="st-placecard__name">{p.name}</span>
                    <span className="st-placecard__area">{p.area}</span>
                  </button>
                ))}
              </fieldset>
            </details>
            <div className="st-new__nav">
              <Link to="/" className="ib-link">
                Cancel
              </Link>
              <button type="button" className="ib-btn" onClick={() => setStep(1)}>
                Next: building type
              </button>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="st-new__step" aria-labelledby="s1">
            <h1 id="s1" className="st-new__title">
              What kind of building?
            </h1>
            <p className="st-new__lede">
              The type seeds the rooms, schedules, systems and which codes apply. You can mix uses by floor
              later.
            </p>
            <TypeCards value={type} onChange={pickType} />
            <div className="st-new__nav">
              <button type="button" className="ib-link" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="ib-btn" disabled={!type} onClick={() => setStep(2)}>
                Next: the building
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="st-new__step" aria-labelledby="s2">
            <h1 id="s2" className="st-new__title">
              Start from
            </h1>
            <ChoiceChips
              id="start"
              label="Start from"
              value={start}
              onChange={setStart}
              choices={[
                { value: 'template', label: 'A massing template' },
                { value: 'trace', label: canDraw ? 'Trace a plan' : 'Trace a plan (bigger screen)' },
                { value: 'sample', label: 'The Vindhya Bhavan sample' },
              ]}
            />
            {start === 'trace' ? (
              <p className="st-note">
                {canDraw
                  ? 'You get an empty storey with the drawing under it in Make: add the image there and trace rooms with R and P.'
                  : 'Drawing a building needs a bigger screen. You can still start from a template here.'}
              </p>
            ) : null}
            {start === 'sample' ? (
              <p className="st-note">
                A copy of the traced campus block: three storeys and a cellar around two courtyards. The
                original stays as it is.
              </p>
            ) : null}
            <label className="st-field">
              <span>Name</span>
              <input
                className="ib-field"
                value={name}
                placeholder={start === 'sample' ? 'Vindhya Bhavan (copy)' : 'New building'}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {start !== 'sample' ? (
              <div className="st-grid2">
                <Dim
                  label="Width"
                  unit="m"
                  value={w}
                  est={est('w')}
                  onChange={(v) => {
                    setW(v);
                    touch('w');
                  }}
                  min={4}
                  max={300}
                  step={1}
                />
                <Dim
                  label="Depth"
                  unit="m"
                  value={dep}
                  est={est('d')}
                  onChange={(v) => {
                    setDep(v);
                    touch('d');
                  }}
                  min={4}
                  max={200}
                  step={1}
                />
                <Dim
                  label="Storeys"
                  unit=""
                  value={n}
                  est={est('n')}
                  onChange={(v) => {
                    setN(v);
                    touch('n');
                  }}
                  min={1}
                  max={60}
                  step={1}
                />
                <Dim
                  label="Floor to floor"
                  unit="m"
                  value={ftf}
                  est={est('f')}
                  onChange={(v) => {
                    setFtf(v);
                    touch('f');
                  }}
                  min={2.4}
                  max={8}
                  step={0.1}
                  decimals={1}
                />
              </div>
            ) : null}
            <div className="st-new__nav">
              <button type="button" className="ib-link" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="ib-btn" onClick={() => setStep(3)}>
                Next: rooms and windows
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="st-new__step" aria-labelledby="s3">
            <h1 id="s3" className="st-new__title">
              Rooms, windows and shading
            </h1>
            {start === 'sample' ? (
              <p className="st-note">
                The sample already has its rooms and windows. Change them in Make or with the levers in
                Choose.
              </p>
            ) : (
              <>
                <ChoiceChips
                  id="zone"
                  label="Rooms"
                  value={zone}
                  onChange={setZone}
                  choices={[
                    { value: 'auto', label: 'Auto-zone by type (perimeter and core)' },
                    { value: 'one', label: 'One room per floor' },
                  ]}
                />
                <Dim
                  label="Window share of each wall"
                  unit="%"
                  value={wwr}
                  est={est('wwr')}
                  onChange={(v) => {
                    setWwr(v);
                    touch('wwr');
                  }}
                  min={0}
                  max={90}
                  step={5}
                />
                <p className="st-note">
                  Rooms take the type's main function; anything you have not set is an estimate and widens the
                  energy range until you confirm it.
                </p>
              </>
            )}
            <div className="st-new__nav">
              <button type="button" className="ib-link" onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" className="ib-btn" onClick={() => setStep(4)}>
                Next: place it in the city
              </button>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="st-new__step st-new__step--wide" aria-labelledby="s4">
            <h1 id="s4" className="st-new__title">
              Place it among its neighbours
            </h1>
            <div className="st-new__city">
              <CityStage
                doc={{
                  ...placed,
                  rotationMdeg: Math.round(rot * 1000) + (start === 'sample' ? preview.rotationMdeg : 0),
                }}
                place={placeFor()}
                tiles={tiles}
                level="site"
                night={false}
                reducedMotion
                date="mar"
                minutes={15 * 60 + 30}
                lens="shadows"
                job={undefined}
              />
            </div>
            <Dim
              label="Turn the building"
              unit="°"
              value={rot}
              est={est('rot')}
              onChange={(v) => {
                setRot(v);
                touch('rot');
              }}
              min={-180}
              max={180}
              step={5}
            />
            <p className="st-note">
              Neighbours with estimated heights are hatched; their shadows carry a penumbra out to the
              plausible height.
            </p>
            <div className="st-new__nav">
              <button type="button" className="ib-link" onClick={() => setStep(3)}>
                Back
              </button>
              <button type="button" className="ib-btn ib-btn--hero" onClick={finish}>
                See the first results
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Dim(p: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  est: string | undefined;
}) {
  const id = `dim-${p.label.replace(/\W+/g, '-')}`;
  return (
    <div className="st-field">
      <label htmlFor={id}>
        {p.label} {p.est ? <span className="ib-badge-estimate">estimate</span> : null}
      </label>
      <span className="st-field__row">
        <Stepper
          id={id}
          label={p.label}
          value={p.value}
          min={p.min}
          max={p.max}
          step={p.step}
          {...(p.decimals ? { decimals: p.decimals } : {})}
          onChange={p.onChange}
        />
        <span className="st-field__unit">{p.unit}</span>
      </span>
    </div>
  );
}
