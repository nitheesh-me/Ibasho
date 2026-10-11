/**
 * Test sites and orientations (SPEC 27 step 4): the same design on two or three plots or bearings,
 * side by side, with synced cameras (scale level, azimuth, time) and the same lens. Each pane is a
 * `CityStage` without its own chrome; one shared bar drives them all. Owner: WP-07.
 */

import type { FacadeBin } from '@ibasho/core';
import { type CSSProperties, useState } from 'react';
import { Compass, Ladder, LensChips } from './CityChrome.tsx';
import { CityStage, type CityStageProps, DEFAULT_TIME, type LensSummary, layoutOf } from './CityStage.tsx';
import type { Placement, PlacementCheck } from './placement.ts';
import type { CityTime } from './sun.ts';
import type { CityLensId, ZoomLevel } from './types.ts';

export interface CompareOption {
  id: string;
  /** Plain label, e.g. "Plot A, 220°" or "London, Camden". */
  label: string;
  placement?: Placement;
  /** A different city for this option (tiles, place, hide ids); the rest comes from `base`. */
  overrides?: Partial<
    Pick<CityStageProps, 'tiles' | 'place' | 'hideContextIds' | 'roads' | 'site' | 'daylight'>
  >;
}

export interface CityCompareProps {
  /** Shared stage props (hero, compiled, tiles, place, lanterns...). */
  base: Omit<CityStageProps, 'level' | 'lens' | 'time' | 'azimuthDeg' | 'placement' | 'controls'>;
  /** Two or three options. */
  options: readonly CompareOption[];
  level?: ZoomLevel;
  lens?: CityLensId;
  time?: CityTime;
  onLevelChange?: (l: ZoomLevel) => void;
  onLensChange?: (l: CityLensId) => void;
  /** Site check per option, as each pane computes it. */
  onSiteCheck?: (optionId: string, check: PlacementCheck) => void;
  style?: CSSProperties;
  /** No header or captions: the panes alone (landing stills). */
  bare?: boolean;
}

export function CityCompare(p: CityCompareProps) {
  const [levelOwn, setLevel] = useState<ZoomLevel>('site');
  const [lensOwn, setLens] = useState<CityLensId>('none');
  const [az, setAz] = useState(135);
  const [checks, setChecks] = useState<Record<string, PlacementCheck>>({});
  const [sums, setSums] = useState<Record<string, LensSummary>>({});
  const level = p.level ?? levelOwn;
  const lens = p.lens ?? lensOwn;
  const time = p.time ?? DEFAULT_TIME;
  const opts = p.options.slice(0, 3);
  const [width, setWidth] = useState(1280);
  const phone = layoutOf(width) === 'phone';
  return (
    <div
      className="ib-city"
      ref={(el) => {
        if (el && Math.abs(el.clientWidth - width) > 8) setWidth(el.clientWidth);
      }}
      style={{ display: 'grid', gridTemplateRows: p.bare ? '1fr' : 'auto 1fr', height: '100%', ...p.style }}
    >
      {p.bare ? null : (
        <div
          className="ib-plate ib-city-panel"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: 8 }}
        >
          <Ladder
            level={level}
            onLevel={(l) => {
              setLevel(l);
              p.onLevelChange?.(l);
            }}
            layout="breadcrumb"
            detail={{}}
            enabled={['city', 'site', 'building', 'floor']}
          />
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <LensChips
              lens={lens}
              onLens={(l) => {
                setLens(l);
                p.onLensChange?.(l);
              }}
            />
          </div>
          <Compass
            azimuthDeg={az}
            onTurn={(d) => setAz((a) => Math.round(a / 45) * 45 + d)}
            onNorth={() => setAz(180)}
            onZoom={() => {}}
          />
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: phone ? '1fr' : `repeat(${opts.length}, minmax(0, 1fr))`,
          gap: 2,
          minHeight: 0,
        }}
      >
        {opts.map((o, oi) => {
          const c = checks[o.id];
          const d = diffOf(sums[opts[0]!.id], sums[o.id], lens, oi === 0);
          return (
            <section
              key={o.id}
              aria-label={o.label}
              style={{ position: 'relative', minHeight: phone ? 280 : 0 }}
            >
              <CityStage
                {...p.base}
                {...(o.overrides ?? {})}
                {...(o.placement ? { placement: o.placement } : {})}
                level={level}
                lens={lens}
                time={time}
                azimuthDeg={az}
                controls={false}
                legend={false}
                {...(d?.emphasis ? { emphasis: d.emphasis } : {})}
                onLensSummary={(sum) => setSums((x) => (x[o.id] === sum ? x : { ...x, [o.id]: sum }))}
                onSiteCheck={(check) => {
                  setChecks((s) => (s[o.id] === check ? s : { ...s, [o.id]: check }));
                  p.onSiteCheck?.(o.id, check);
                }}
              />
              {p.bare ? null : (
                <div
                  className="ib-plate ib-city-panel ib-city-note"
                  style={{ position: 'absolute', left: 8, top: 8, maxWidth: 'calc(100% - 16px)' }}
                >
                  <b>{o.label}</b>
                  {c ? (
                    <span className="ib-city-unit" style={{ display: 'block' }}>
                      {c.free ? 'Free plot' : `Overlaps ${c.overlaps.length}`}
                      {c.shading.length
                        ? `; shaded ${c.shading.reduce((a, x) => a + x.hours, 0)} neighbour hours on the test days`
                        : '; no neighbour shade on the test days'}
                    </span>
                  ) : null}
                  {d ? (
                    <span className="ib-city-unit" style={{ display: 'block' }} data-tone={d.tone}>
                      {d.text}
                    </span>
                  ) : null}
                </div>
              )}
              {!p.bare && d && d.tone !== 'same' && oi > 0 ? (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    boxShadow: `inset 0 0 0 2px ${d.tone === 'worse' ? '#D7644D' : '#306C45'}`,
                  }}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What differs between an option and the first (QA compare): the lens number and its change in
 * words, a frame tint (warm worse, green better; never seal colours), and for radiation the facade
 * where the difference is largest, outlined on the building.
 */
export function diffOf(
  base: LensSummary | undefined,
  opt: LensSummary | undefined,
  lens: CityLensId,
  first: boolean,
): {
  text: string;
  tone: 'better' | 'worse' | 'same';
  emphasis?: { bins: FacadeBin[]; tone: 'more' | 'less' };
} | null {
  if (!opt || opt.lens !== lens || opt.value === null) return null;
  const fmt = (v: number): string =>
    opt.unit === '%' ? v.toFixed(0) : opt.unit === 'h a day' ? v.toFixed(1) : v.toFixed(0);
  const own = `${opt.label}: ${fmt(opt.value)} ${opt.unit}`;
  if (first || !base || base.lens !== lens || base.value === null) return { text: own, tone: 'same' };
  const dv = opt.value - base.value;
  const small = Math.abs(dv) < (opt.unit === '%' ? 1 : opt.unit === 'h a day' ? 0.1 : 10);
  if (small) return { text: `${own}, about the same as the first`, tone: 'same' };
  const better = opt.lowerIsBetter ? dv < 0 : dv > 0;
  let emphasis: { bins: FacadeBin[]; tone: 'more' | 'less' } | undefined;
  let where = '';
  if (opt.bins && base.bins) {
    let best: [FacadeBin, number] | null = null;
    for (const [b, v] of Object.entries(opt.bins) as [FacadeBin, number][]) {
      const bv = base.bins[b];
      if (bv === undefined) continue;
      if (!best || Math.abs(v - bv) > Math.abs(best[1])) best = [b, v - bv];
    }
    if (best && Math.abs(best[1]) >= 10) {
      emphasis = { bins: [best[0]], tone: best[1] > 0 ? 'more' : 'less' };
      where = `; most on the ${best[0]} facade (${best[1] > 0 ? '+' : ''}${best[1].toFixed(0)})`;
    }
  }
  return {
    text: `${own}, ${dv > 0 ? '+' : ''}${fmt(dv)} against the first${where}`,
    tone: better ? 'better' : 'worse',
    ...(emphasis ? { emphasis } : {}),
  };
}
