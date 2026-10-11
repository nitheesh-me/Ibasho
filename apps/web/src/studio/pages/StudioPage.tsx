/**
 * The studio (SPEC 17, DS 13.7, UV 4). Owner: WP-08.
 *
 * One page for City, Site, Building, Floor and Room, in five modes that share one stage and never
 * reload it. Desktop: ladder on the left, Niwa about 62%, Zashiki on the right, time strip under the
 * Niwa, engawa with narrator and StageBar. Wide (1600+): Make splits plan and 3D. Tablet: the
 * Zashiki is a side sheet and the ladder a breadcrumb. Phone: Niwa on top, a bottom sheet with
 * peek, half and full, tabs Look, Choose, Tell, More, light edits only.
 *
 * Keys: `[` and `]` step the ladder, M L C P T switch modes (not while typing or in the plan).
 */
import type { BuildingDoc, ResolutionLevel } from '@ibasho/core';
import {
  EvidenceProvider,
  MODE_LABEL,
  ModeTabs,
  Num,
  Picker,
  PreviewStamp,
  SCALE_LEVELS,
  ScaleLadder,
  type ScaleLevel,
  StageBar,
  type StudioMode,
  stepLevel,
} from '@ibasho/ui';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useShell, useTopBar } from '../../shell/Shell.tsx';
import { useBreakpoint, useBuildingEvidence, useJob, useJobBar, useReducedMotion } from '../hooks.ts';
import { CityStage, type DateId, PlanStage, TimeStrip } from '../niwa/Niwa.tsx';
import { ChoosePanel, CompareView } from '../panels/Choose.tsx';
import { type LensId, LookPanel } from '../panels/Look.tsx';
import { MakePanel } from '../panels/Make.tsx';
import { ProvePanel, TellPanel } from '../panels/ProveTell.tsx';
import { BuildingSummary, Card, KeyNumbers } from '../panels/Summary.tsx';
import type { Levers } from '../preview/settings.ts';
import { BASE_VARIANT, jobKey, useStudio, variantDoc } from '../state/studio.ts';

const MODES: readonly StudioMode[] = ['make', 'look', 'choose', 'prove', 'tell'];

export function StudioPage() {
  const { placeId = '', buildingId: bParam } = useParams();
  const [q, setQ] = useSearchParams();
  const nav = useNavigate();
  const bpt = useBreakpoint();
  const reduced = useReducedMotion();
  const { theme } = useShell();
  const ready = useStudio((s) => s.ready);
  const placeEntry = useStudio((s) => s.places[placeId]);
  const buildings = useStudio((s) => s.buildings);
  const settings = useStudio((s) => s.settings);
  const revisit = useStudio((s) => s.revisit);
  const st = useStudio.getState();

  const buildingId = bParam ?? placeEntry?.place.buildingIds[0];
  const b = buildingId ? buildings[buildingId] : undefined;
  const level = (SCALE_LEVELS as readonly string[]).includes(q.get('level') ?? '')
    ? (q.get('level') as ScaleLevel)
    : bParam
      ? 'building'
      : 'site';
  const mode = (MODES as readonly string[]).includes(q.get('mode') ?? '')
    ? (q.get('mode') as StudioMode)
    : 'look';
  const lens = (q.get('lens') as LensId | null) ?? 'radiation';
  const setParam = useCallback(
    (k: string, v: string) =>
      setQ(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set(k, v);
          return n;
        },
        { replace: true },
      ),
    [setQ],
  );
  const setLevel = useCallback(
    (l: ScaleLevel) => {
      if (!bParam && (l === 'building' || l === 'floor' || l === 'room') && buildingId)
        nav(`/p/${placeId}/b/${buildingId}?level=${l}&mode=${mode}`);
      else setParam('level', l);
    },
    [bParam, buildingId, mode, nav, placeId, setParam],
  );
  const setMode = useCallback(
    (m: StudioMode) => {
      if (m === 'make' && (level === 'city' || level === 'site' || level === 'building')) {
        setQ((prev) => {
          const n = new URLSearchParams(prev);
          n.set('mode', m);
          n.set('level', 'floor');
          return n;
        });
        if (!bParam && buildingId) nav(`/p/${placeId}/b/${buildingId}?level=floor&mode=make`);
      } else setParam('mode', m);
    },
    [level, setQ, setParam, bParam, buildingId, nav, placeId],
  );

  const [storeyId, setStoreyId] = useState<string>('');
  const [selection, setSelection] = useState<string[]>([]);
  const [segId, setSegId] = useState<string | undefined>();
  const [date, setDate] = useState<DateId>('mar');
  const [minutes, setMinutes] = useState(15 * 60 + 30);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [underlays, setUnderlays] = useState<Record<string, string>>({});
  const [phoneTab, setPhoneTab] = useState<StudioMode>('look');

  // Search and deep links: `floor`, `room` and `focus` set the storey, the selection and the scene focus.
  const qFloor = q.get('floor');
  const qRoom = q.get('room');
  const focusId = q.get('focus') ?? undefined;
  const bboxParam = q.get('bbox');
  const focusBox = useMemo(() => {
    const n = bboxParam?.split(',').map(Number);
    return n && n.length === 4 && n.every(Number.isFinite)
      ? { minX: n[0] as number, minY: n[1] as number, maxX: n[2] as number, maxY: n[3] as number }
      : undefined;
  }, [bboxParam]);
  useEffect(() => {
    if (qFloor) setStoreyId(qFloor);
    if (qRoom) setSelection([qRoom]);
  }, [qFloor, qRoom]);

  // Default storey: the first above grade.
  useEffect(() => {
    if (!b) return;
    if (!b.doc.storeys.some((s) => s.id === storeyId))
      setStoreyId((b.doc.storeys.find((s) => !s.belowGrade) ?? b.doc.storeys[0])?.id ?? '');
  }, [b, storeyId]);

  // First results: run every variant once when the building opens.
  // Pack places wait for the city tiles (a second or so) so the stages run once, never restart.
  const packId = placeEntry?.place.cityPackId;
  const tilesReady = useStudio((s) => (packId ? s.areas[packId] !== undefined : true));
  const needsTiles = Boolean(packId);
  useEffect(() => {
    useStudio.getState().ensureArea(packId);
  }, [packId]);
  useEffect(() => {
    if (!b || (needsTiles && !tilesReady)) return;
    const s = useStudio.getState();
    if (!s.jobs[jobKey(b.id, BASE_VARIANT)]) s.runBuilding(b.id);
  }, [b, needsTiles, tilesReady]);

  // Revisit: what changed since the last visit to this place.
  // A place that loads on demand (found by search or a link) joins the studio when first opened.
  useEffect(() => {
    if (ready && !placeEntry) useStudio.getState().addSamplePlace(placeId);
  }, [ready, placeEntry, placeId]);
  const hasPlace = Boolean(placeEntry);
  useEffect(() => {
    if (ready && hasPlace) useStudio.getState().visit(placeId);
  }, [ready, placeId, hasPlace]);

  // Keyboard: ladder and modes.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        !t ||
        t.closest('input, textarea, select, [contenteditable], .ib-editor') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.key === '[') setLevel(stepLevel(level, -1));
      else if (e.key === ']') setLevel(stepLevel(level, 1));
      else {
        const m = MODES.find((x) => x[0] === e.key.toLowerCase());
        if (m) setMode(m);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [level, setLevel, setMode]);

  const focusVariant = b?.focus ?? BASE_VARIANT;
  // Render-stable jobs: progress ticks never re-render the studio or the scene (round 5 stall).
  const job = useJob(b?.id, focusVariant);
  const baseJob = useJob(b?.id, BASE_VARIANT);
  const live = useJobBar(b ? jobKey(b.id, focusVariant) : undefined);
  const evidence = useBuildingEvidence(b?.id);
  const areaTilesNow = useStudio((s) => (packId ? s.areas[packId] : undefined));
  const resolution = String(settings['analysis.resolution']) as ResolutionLevel;
  const phone = bpt === 'phone';
  const variantName = b?.variants.find((v) => v.id === focusVariant)?.name ?? 'As it is';

  useTopBar(
    b && placeEntry ? (
      <div className="st-bar">
        <nav className="st-bar__crumbs" aria-label="Where you are">
          <Link to="/" className="st-bar__crumb">
            {placeEntry.place.name}
          </Link>
          <span aria-hidden="true">›</span>
          <Picker
            label="Building"
            hideLabel
            quiet
            value={b.id}
            options={placeEntry.place.buildingIds.map((id) => ({
              value: id,
              label: buildings[id]?.name ?? id,
            }))}
            onChange={(id) => nav(`/p/${placeId}/b/${id}?level=building&mode=${mode}`)}
          />
          <span aria-hidden="true">›</span>
          <Picker
            label="Scenario"
            hideLabel
            quiet
            value={focusVariant}
            options={b.variants.map((v) => ({ value: v.id, label: v.name }))}
            onChange={(id) => st.setFocus(b.id, id)}
          />
        </nav>
        <ModeTabs mode={mode} onChange={setMode} hidden={phone ? ['make'] : []} controls="st-zashiki" />
      </div>
    ) : null,
    [b?.id, b?.variants, placeEntry?.place.name, mode, focusVariant, phone, buildings, setMode],
  );

  if (!ready) return <p className="st-loading">Opening your places.</p>;
  if (!placeEntry || !b) {
    return (
      <div className="st-notfound">
        <h1>This place is not in your studio</h1>
        <p>It may have been deleted on another device, or the link is from a branch you removed.</p>
        <Link to="/" className="ib-btn">
          Back to your places
        </Link>
      </div>
    );
  }

  const storey = b.doc.storeys.find((s) => s.id === storeyId);
  const onSelect = (ids: string[], seg?: string) => {
    setSelection(ids);
    setSegId(seg);
    if (ids.length && level === 'floor' && mode !== 'make') setParam('level', 'room');
  };
  const planLevel = mode === 'make';
  const showCompare = mode === 'choose' && b.variants.length > 1 && !planLevel;
  const night = theme === 'yoru';

  const plan = (editable: boolean) => (
    <PlanStage
      doc={b.doc}
      storeyId={storeyId}
      onStorey={setStoreyId}
      selection={selection}
      onSelect={onSelect}
      lens={editable ? 'shadows' : lens}
      job={baseJob}
      readOnly={!editable}
      limited={phone}
      grid={phone ? 300 : 100}
      {...(underlays[storeyId] ? { underlayUrl: underlays[storeyId] } : {})}
      {...(editable
        ? {
            onEdit: (label, recipe) => st.editDoc(b.id, label, recipe),
            onUndo: () => st.undo(b.id),
            onRedo: () => st.redo(b.id),
            canUndo: b.history.past.length > 0,
            canRedo: b.history.future.length > 0,
          }
        : {})}
    />
  );
  const city = (variantId = focusVariant, compact = false, azimuthDeg?: number) => {
    const v = b.variants.find((x) => x.id === variantId);
    const j = useStudio.getState().jobs[jobKey(b.id, variantId)];
    return (
      <CityStage
        doc={v && Object.keys(v.changes).length ? docFor(b.doc, v.changes) : b.doc}
        place={placeEntry.place}
        tiles={areaTilesNow ?? []}
        level={compact ? 'building' : level}
        {...(compact ? {} : { onLevel: setLevel })}
        {...(storeyId ? { storeyId } : {})}
        {...(selection[0] ? { roomId: selection[0] } : {})}
        onSelect={(t) => {
          if (t.kind === 'hero' && t.roomId) {
            if (t.storeyId) setStoreyId(t.storeyId);
            onSelect([t.roomId]);
          }
        }}
        night={night}
        reducedMotion={reduced}
        date={date}
        minutes={minutes}
        onMinutes={setMinutes}
        lens={mode === 'look' ? lens : 'shadows'}
        job={j}
        {...(focusId ? { focus: focusId } : {})}
        {...(focusBox ? { focusBox } : {})}
        compact={compact}
        {...(azimuthDeg !== undefined ? { azimuthDeg } : {})}
        {...(compact
          ? {}
          : {
              label: (
                <span className="st-label">
                  <strong>{b.name}</strong> <span className="st-label__type">{b.typeId}</span>
                  {j?.views.energy ? (
                    <span>
                      EUI <Num ev={j.views.energy.eui} size="ui" />
                    </span>
                  ) : null}
                  <PreviewStamp compact />
                </span>
              ),
            })}
      />
    );
  };

  let niwa: ReactNode;
  if (showCompare) niwa = <CompareView b={b} render={(vid) => city(vid, true)} />;
  else {
    // The scene stays mounted across modes (one stage, never reloaded, PLAN-V3 5): Make hides it below
    // 1600 px instead of unmounting it, which also avoids React's nested root unmount warning (B-m9).
    const split = planLevel && bpt === 'wide';
    niwa = (
      <div className="st-split" data-split={split ? '' : undefined} data-plan={planLevel ? '' : undefined}>
        {planLevel ? <div className="st-split__plan">{plan(mode === 'make')}</div> : null}
        <div className="st-split__axo" hidden={planLevel && !split}>
          {planLevel ? city(BASE_VARIANT, false, 180) : city()}
        </div>
      </div>
    );
  }

  const roomPanel =
    level === 'room' && selection.length ? (
      <Card title="Room" kicker={storey?.name}>
        <KeyNumbers
          items={[
            { label: 'Daylit share of the building', ev: baseJob?.views.daylight?.ecbc },
            { label: 'Hours comfortable with ceiling fans alone', ev: baseJob?.views.energy?.fanHours },
          ]}
        />
        <p className="st-note">
          Results for a single room are not available yet; these are for the whole building. Open Make to
          change this room.
        </p>
      </Card>
    ) : null;

  const zashikiFor = (m: StudioMode) => {
    switch (m) {
      case 'make':
        return (
          <MakePanel
            b={b}
            storeyId={storeyId}
            onStorey={setStoreyId}
            selection={selection}
            segId={segId}
            onSelect={onSelect}
            limited={phone}
            underlays={underlays}
            onUnderlay={(sid, url) => setUnderlays((u) => ({ ...u, ...(url ? { [sid]: url } : {}) }))}
          />
        );
      case 'look':
        return (
          <>
            {roomPanel}
            <LookPanel
              lens={lens}
              onLens={(l) => setParam('lens', l)}
              typeId={b.typeId}
              place={placeEntry.place}
              job={job}
              resolution={resolution}
              onResolution={(r) => st.setSetting('analysis.resolution', r)}
              when={`${dateLabel(date)}, ${fmtHour(minutes / 60)}`}
              where={
                planLevel
                  ? (storey?.name ?? 'This floor')
                  : level === 'city'
                    ? 'The neighbourhood'
                    : level === 'site'
                      ? 'Your building and 300 m around'
                      : 'Every facade and the roof'
              }
            />
            {level === 'building' || level === 'site' ? (
              <BuildingSummary job={job} typeId={b.typeId} />
            ) : null}
          </>
        );
      case 'choose':
        return <ChoosePanel b={b} />;
      case 'prove':
        return <ProvePanel job={job} b={b} />;
      case 'tell':
        return <TellPanel b={b} />;
    }
  };

  const zashiki = <div className="st-zashiki__inner">{zashikiFor(phone ? phoneTab : mode)}</div>;
  const changes = revisit?.placeId === placeId ? revisit : undefined;

  return (
    <EvidenceProvider source={evidence}>
      <div
        className="st-studio"
        data-panel={bpt === 'tablet' && !sheetOpen ? 'hidden' : undefined}
        data-bp={bpt}
        data-mode={mode}
        data-level={level}
      >
        {bpt === 'desktop' || bpt === 'wide' ? (
          <aside className="st-ladder">
            <ScaleLadder
              level={level}
              onChange={setLevel}
              detail={{ floor: storey?.name ?? '', building: b.name }}
              enabled={selection.length ? SCALE_LEVELS : SCALE_LEVELS.filter((l) => l !== 'room')}
            />
          </aside>
        ) : (
          <div className="st-crumbs">
            <ScaleLadder
              level={level}
              onChange={setLevel}
              layout="breadcrumb"
              enabled={selection.length ? SCALE_LEVELS : SCALE_LEVELS.filter((l) => l !== 'room')}
            />
            {bpt === 'tablet' ? (
              <button
                type="button"
                className="ib-chip"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen((o) => !o)}
              >
                {sheetOpen ? 'Hide panel' : 'Show panel'}
              </button>
            ) : null}
          </div>
        )}
        <section className="st-niwa" aria-label={`${MODE_LABEL[mode]}: ${b.name}, ${variantName}`}>
          {niwa}
        </section>
        {mode !== 'look' ? null : (
          <div className="st-timestrip">
            <TimeStrip
              date={date}
              onDate={setDate}
              minutes={minutes}
              onMinutes={setMinutes}
              reducedMotion={reduced}
              lat={placeEntry.place.lat}
              lon={placeEntry.place.lon}
            />
          </div>
        )}
        {bpt === 'desktop' || bpt === 'wide' ? (
          <aside className="st-zashiki" id="st-zashiki" aria-label={`${MODE_LABEL[mode]} panel`}>
            {zashiki}
          </aside>
        ) : phone ? (
          // Phone: the panel sits under the stage in the page flow (robust at 360 px; the stage stays at 45%).
          <section className="st-phonepanel" id="st-zashiki" aria-label={`${MODE_LABEL[phoneTab]} panel`}>
            <div className="st-phonetabs">
              <ModeTabs mode={phoneTab} onChange={setPhoneTab} hidden={['make']} controls="st-zashiki" />
            </div>
            {zashiki}
          </section>
        ) : sheetOpen ? (
          // Tablet: the panel is a column beside the stage (an overlay sheet covered the time strip, round 6).
          <aside className="st-zashiki" id="st-zashiki" aria-label={`${MODE_LABEL[mode]} panel`}>
            {zashiki}
          </aside>
        ) : null}
        <section className="st-engawa" aria-label="Progress and narrator">
          <p className="st-narrator">
            {changes && !changes.dismissed ? (
              <>
                Since your last visit: {changes.changes.map((c) => c.short).join(', ')}.{' '}
                <Link to="/" className="ib-link">
                  What changed
                </Link>{' '}
                <button type="button" className="ib-link" onClick={() => st.dismissRevisit()}>
                  Dismiss
                </button>
              </>
            ) : (
              <Narration b={b.name} job={job} />
            )}
          </p>
          <StageBar
            state={live.bar}
            {...(live.message ? { message: live.message } : {})}
            onCancel={() => st.cancel(b.id, focusVariant)}
            compact={bpt !== 'wide' && bpt !== 'desktop'}
          />
        </section>
      </div>
    </EvidenceProvider>
  );
}

function Narration({
  b,
  job,
}: {
  b: string;
  job: ReturnType<typeof useStudio.getState>['jobs'][string] | undefined;
}) {
  const e = job?.views.energy;
  const r = job?.views.radiation;
  if (!e) return <>Working out {b}: sun first, then light, then energy.</>;
  const hot = r ? [...r.facades].sort((a, c) => c.kwh - a.kwh)[0] : undefined;
  return (
    <>
      EUI now <Num ev={e.eui} size="ui" plain />
      {job?.tiers.energy !== 'final' ? ' (still refining)' : ''}
      {hot ? `. The ${hot.bin} facades take the most sun.` : '.'}
    </>
  );
}

const dateLabel = (d: DateId) => ({ mar: '21 March', may: '21 May', jun: '21 June', dec: '21 December' })[d];
const fmtHour = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

const docCache = new WeakMap<BuildingDoc, Map<string, BuildingDoc>>();
function docFor(base: BuildingDoc, changes: Levers): BuildingDoc {
  const key = JSON.stringify(changes);
  let m = docCache.get(base);
  if (!m) {
    m = new Map();
    docCache.set(base, m);
  }
  let d = m.get(key);
  if (!d) {
    d = variantDoc(base, changes);
    m.set(key, d);
  }
  return d;
}
