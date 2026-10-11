/**
 * Dev harness for `<CityStage>` (WP-07, V-P): GB1 Vindhya (compiled by `@ibasho/plan`) on the
 * real `city-hyderabad` pack tiles (OSM). Not shipped. `?standin=1` uses the scene's stand ins.
 * `?place=1` turns on placing (SPEC 27); `?compare=1` shows three plots or bearings side by side.
 * URL parameters drive captures:
 *   ?level=city|site|building|floor|room&lens=none|shadows|sun-hours|radiation|daylight|lanterns
 *   &style=washi|yoru|svg&date=2026-03-21&min=630&az=135&photo=0..1&tier=0..3&reduced=1
 *   &floors=<n> (moment 7)&plots=2|3 (compare)&controls=0&sweep=1&close=<context id>:<mm>&focus=building|storey:<id>|room:<id>|<context id>
 */
import type { BuildingDoc, CityTile, CompiledBuilding, Mm, QualityTier } from '@ibasho/core';
import '@ibasho/ui/andon.css';
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HERO_CONTEXT_IDS, loadCityTiles } from '../../../packs/city-hyderabad/src/engine/index.ts';
import gb1 from '../../fixtures/src/buildings/gb1.building.json' with { type: 'json' };
import { compile } from '../../plan/src/index.ts';
import {
  CityCompare,
  type CityFocus,
  type CityLensId,
  CityStage,
  type CityStats,
  type CityStyle,
  type ZoomLevel,
} from '../src/index.ts';

const q = new URLSearchParams(location.search);
const standIn = q.get('standin') === '1';
const doc = gb1 as unknown as BuildingDoc;

function focusOf(v: string): CityFocus {
  const [kind, id] = v.split(':');
  if (kind === 'building') return { kind: 'building', buildingId: doc.id };
  if (kind === 'storey') return { kind: 'storey', buildingId: doc.id, storeyId: id! };
  if (kind === 'room') return { kind: 'room', buildingId: doc.id, roomId: id! };
  return { kind: 'building', buildingId: v };
}

function App() {
  const stats = useRef<CityStats | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Mm>>({});
  const [tiles, setTiles] = useState<CityTile[] | null>(standIn ? [] : null);
  const style = (q.get('style') as CityStyle) ?? 'washi';
  const compiled = useMemo<CompiledBuilding | null>(() => (standIn ? null : compile(doc)), []);
  useEffect(() => {
    if (standIn) return;
    loadCityTiles().then(setTiles, (e) => {
      console.error('city tiles', e);
      setTiles([]);
    });
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      (window as unknown as { __cityStats?: CityStats | null }).__cityStats = stats.current
        ? { ...stats.current }
        : null;
    }, 250);
    const close = q.get('close');
    if (close) {
      const [cid, mm] = close.split(':');
      setTimeout(() => setOverrides({ [cid!]: Number(mm) }), 1500);
    }
    return () => clearInterval(id);
  }, []);
  const photo = q.get('photo');
  const [level, setLevel] = useState<ZoomLevel>((q.get('level') as ZoomLevel) ?? 'site');
  const [lens, setLens] = useState<CityLensId>((q.get('lens') as CityLensId) ?? 'none');
  const [time, setTime] = useState({
    date: q.get('date') ?? '2026-03-21',
    minutes: Number(q.get('min') ?? 630),
  });
  const [focus, setFocus] = useState<CityFocus | null>(q.get('focus') ? focusOf(q.get('focus')!) : null);
  if (tiles !== null && q.get('compare') === '1') {
    const base = {
      style,
      ...(standIn
        ? {}
        : {
            tiles,
            hero: doc,
            hideContextIds: HERO_CONTEXT_IDS.gb1 ?? [],
            ...(compiled ? { compiled } : {}),
          }),
    };
    const o = doc.origin;
    const r = doc.rotationMdeg;
    return (
      <div style={{ height: '100vh' }}>
        <CityCompare
          base={base}
          options={(
            [
              { id: 'a', label: 'As drawn', placement: { origin: o, rotationMdeg: r } },
              { id: 'b', label: 'Turned 90°', placement: { origin: o, rotationMdeg: r + 90_000 } },
              {
                id: 'c',
                label: 'Plot 250 m east',
                placement: { origin: { x: o.x + 250_000, y: o.y }, rotationMdeg: r },
              },
            ] as const
          ).slice(0, Number(q.get('plots') ?? 3))}
          level={(q.get('level') as ZoomLevel) ?? 'site'}
          lens={(q.get('lens') as CityLensId) ?? 'none'}
          time={time}
          bare={q.get('controls') === '0'}
        />
      </div>
    );
  }
  if (tiles === null)
    return <p style={{ padding: 24, fontFamily: 'var(--font-gothic)' }}>Loading the city pack</p>;
  return (
    <div style={{ height: '100vh' }}>
      <CityStage
        style={style}
        {...(standIn ? {} : { tiles, hero: doc, compiled, hideContextIds: HERO_CONTEXT_IDS.gb1 ?? [] })}
        level={level}
        onLevelChange={setLevel}
        lens={lens}
        onLensChange={setLens}
        time={time}
        onTimeChange={setTime}
        {...(q.get('az') ? { azimuthDeg: Number(q.get('az')) } : {})}
        {...(photo
          ? {
              // Preview steps shaped like the optimise stage's output (dev harness only).
              phototropic: {
                t: Number(photo),
                preview: true,
                steps: [0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => ({
                  t,
                  euiKwhM2: [172, 166, 158, 151, 146, 141][i]!,
                })),
              },
            }
          : {})}
        {...(q.get('floors') ? { addedFloors: Number(q.get('floors')) } : {})}
        {...(q.get('sweep') === '1' ? { sweep: { dates: ['2026-03-21', '2026-05-21'], key: 1 } } : {})}
        tierCap={Number(q.get('tier') ?? 2) as QualityTier}
        reducedMotion={q.get('reduced') === '1'}
        controls={q.get('controls') !== '0'}
        heightOverrides={overrides}
        onHeightEnter={(id, mm) => setOverrides((o) => ({ ...o, [id]: mm }))}
        focus={focus}
        placeMode={q.get('place') === '1'}
        onFocusChange={setFocus}
        stats={stats}
      />
    </div>
  );
}

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
