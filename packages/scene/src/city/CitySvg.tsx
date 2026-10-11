/**
 * The city without WebGL (ARCH 10: the SVG renderer is the fallback): a plan of the paper model
 * with sun shadows at the likely heights, the penumbra hatched out to the plausible ones, roads,
 * the hero by room with its lens colour, a north arrow and a scale bar. Owner: WP-07.
 */
import type { SiteResult } from '@ibasho/core';
import { useId, useMemo } from 'react';
import { type Theme, token } from '../colour/palette.ts';
import { boxOf, type EN } from './frame.ts';
import { drawnHeight, roadPolys } from './geometry.ts';
import type { CityModel } from './model.ts';
import { annualKwh, sdaShare, surfaceKey } from './preview.ts';
import { rampHex } from './ramps.ts';
import { shadowPolygons } from './shadow.ts';
import type { CitySun } from './sun.ts';
import type { CityLensId, CityTarget, DaylightGrid, ZoomLevel } from './types.ts';
import type { CityView } from './view.ts';

export interface CitySvgProps {
  model: CityModel;
  theme: Theme;
  lens: CityLensId;
  level: ZoomLevel;
  view: CityView;
  sun: CitySun;
  storeyId?: string | undefined;
  site: SiteResult | null;
  daylight: readonly DaylightGrid[] | null;
  penumbra: boolean;
  width: number;
  height: number;
  onPick?: (t: CityTarget) => void;
  /** Find: outline this neighbour or room in ink. */
  highlight?: { contextId?: string; roomId?: string } | null;
  /** Draw the north arrow and scale bar (the stage's chrome draws its own). Default true. */
  marks?: boolean;
}

const path = (ring: readonly EN[]): string =>
  `M${ring.map(([e, n]) => `${e.toFixed(1)} ${(-n).toFixed(1)}`).join('L')}Z`;

/** Night plan palette: the same values the 3D night city uses (dark card, lamplit hero). */
const NIGHT = {
  ground: '#1d1915',
  road: '#262019',
  context: '#322b23',
  lamp: '#f2c27a',
  lampEdge: '#ffe2b0',
};

export function CitySvg(p: CitySvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { model, theme, sun, view } = p;
  const t = (n: Parameters<typeof token>[0]): string => token(n, theme);
  const aspect = p.width / Math.max(1, p.height);
  // Plan view: frame the same target, a little tighter than the oblique camera.
  const halfH = view.halfH * 0.9;
  const vb = [view.target[0] - halfH * aspect, -view.target[2] - halfH, 2 * halfH * aspect, 2 * halfH];
  const inView = (ring: readonly EN[]): boolean => {
    const b = boxOf(ring);
    return !(
      b.maxE < vb[0]! - 300 ||
      b.minE > vb[0]! + vb[2]! + 300 ||
      -b.minN < vb[1]! - 300 ||
      -b.maxN > vb[1]! + vb[3]! + 300
    );
  };
  const masses = model.masses.filter((m) => inView(m.ring));
  const hero = model.hero;
  const top = hero?.storeys.filter((s) => !s.belowGrade).at(-1);
  const storey =
    p.level === 'floor' || p.level === 'room' ? (hero?.storeys.find((s) => s.id === p.storeyId) ?? top) : top;
  const rooms = hero?.rooms.filter((r) => r.storeyId === storey?.id) ?? [];
  const siteBy = useMemo(
    () =>
      new Map((p.site?.surfaces ?? []).flatMap((s) => [[s.id, s] as const, [surfaceKey(s.id), s] as const])),
    [p.site],
  );
  const grid = p.daylight?.find((g) => g.storeyId === storey?.id);

  const roomFill = (id: string): string => {
    if (p.lens === 'radiation') {
      const s = siteBy.get(`${id}:roof`);
      const k = s ? annualKwh(s) : null;
      if (k !== null) return rampHex('hinata', (k - 200) / 1800);
    }
    if (p.lens === 'sun-hours') {
      const s = siteBy.get(`${id}:roof`);
      if (s?.sunHours) return rampHex('hidamari', s.sunHours.annual / 365 / 13);
    }
    if (p.lens === 'daylight' && grid) return rampHex('akari', sdaShare(grid) / 100);
    // At night the hero is the lantern: warm lamplight rooms on the dark card (matches 3D).
    return theme === 'hiru' ? '#e2d6c2' : NIGHT.lamp;
  };

  const night = theme === 'yoru';
  const up = sun.up && sun.altitudeDeg > 2 && !night;
  const halo = useMemo(() => {
    if (!hero) return null;
    const b = hero.box;
    return {
      c: [(b.minE + b.maxE) / 2, (b.minN + b.maxN) / 2] as const,
      r: Math.max(b.maxE - b.minE, b.maxN - b.minN) * 0.9,
    };
  }, [hero]);
  const shade = up
    ? [
        ...masses
          .filter((m) => !(m.source === 'unknown' && m.user === undefined))
          .flatMap((m) => shadowPolygons(m.ring, drawnHeight(m), sun)),
        ...(hero
          ? hero.prisms
              .filter((pr) => pr.z1 >= hero.height - 0.01)
              .flatMap((pr) => shadowPolygons(pr.ring, pr.z1, sun))
          : []),
      ]
    : [];
  const band =
    up && p.penumbra
      ? masses
          .filter((m) => m.user === undefined && m.hi - m.likely > 0.25)
          .flatMap((m) => shadowPolygons(m.ring, m.hi, sun))
      : [];
  const scale = niceScale(halfH * aspect * 0.5);
  const rot = -((view.azimuthDeg + 180) % 360);
  const px = p.width / vb[2]!;

  return (
    <svg
      viewBox={vb.join(' ')}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Plan of ${model.place.name ?? 'the city'}: ${masses.length} neighbours, ${hero ? hero.name : 'no building'}, sun ${Math.round(sun.altitudeDeg)} degrees high`}
      style={{ display: 'block', background: night ? NIGHT.ground : t('paper') }}
    >
      <defs>
        {night ? (
          <radialGradient id={`halo${uid}`}>
            <stop offset="0" stopColor={NIGHT.lamp} stopOpacity={0.45} />
            <stop offset="1" stopColor={NIGHT.lamp} stopOpacity={0} />
          </radialGradient>
        ) : null}
        <pattern
          id={`hatch${uid}`}
          width={2.2}
          height={2.2}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={2.2} stroke={t('ink-3')} strokeWidth={0.7} strokeOpacity={0.6} />
        </pattern>
      </defs>
      {/* Turn the plan so it matches the 3D view: the camera's look bearing points up (QA m7). */}
      <g transform={`rotate(${rot} ${view.target[0]} ${-view.target[2]})`}>
        {roadPolys(model.roads).map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static road list
          <path key={i} d={path(r)} fill={night ? NIGHT.road : t('paper-sunk')} />
        ))}
        {band.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: derived polygons
          <path key={`b${i}`} d={path(r)} fill={`url(#hatch${uid})`} />
        ))}
        {shade.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: derived polygons
          <path key={`s${i}`} d={path(r)} fill={t('ink')} fillOpacity={0.13} />
        ))}
        {masses.map((m) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; keyboard users pick from the studio outline
          <path
            key={m.id}
            d={path(m.ring)}
            fill={night ? NIGHT.context : t('paper-raised')}
            stroke={p.highlight?.contextId === m.id ? t(night ? 'glow' : 'ink') : t('ink-3')}
            strokeOpacity={night && p.highlight?.contextId !== m.id ? 0.6 : 1}
            strokeWidth={(p.highlight?.contextId === m.id ? 2.4 : 0.4) / Math.max(px, 0.05)}
            strokeDasharray={m.source === 'unknown' || theme === 'yoru' ? `${3 / px} ${2 / px}` : undefined}
            onClick={() => p.onPick?.({ kind: 'context', id: m.id })}
          >
            <title>{`${m.name ?? 'Neighbour'}: ${m.user ?? m.likely} m (${m.user !== undefined ? 'yours' : `${m.source}, ${m.lo} to ${m.hi} m`})`}</title>
          </path>
        ))}
        {night && halo ? (
          <circle cx={halo.c[0]} cy={-halo.c[1]} r={halo.r} fill={`url(#halo${uid})`} pointerEvents="none" />
        ) : null}
        {rooms.map((r) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; keyboard users pick from the studio outline
          <path
            key={r.id}
            d={path(r.ring)}
            fill={roomFill(r.id)}
            stroke={night ? NIGHT.lampEdge : t('ink')}
            strokeWidth={(p.highlight?.roomId === r.id ? 3 : 1.2) / Math.max(px, 0.05)}
            onClick={() =>
              hero && p.onPick?.({ kind: 'hero', buildingId: hero.id, roomId: r.id, storeyId: r.storeyId })
            }
          >
            <title>{`${r.use ?? 'Room'} (${storey?.name ?? ''})`}</title>
          </path>
        ))}
      </g>
      {p.marks === false ? null : (
        <>
          <g
            transform={`translate(${vb[0]! + vb[2]! - 34 / px} ${vb[1]! + 140 / px}) scale(${1 / px}) rotate(${rot})`}
          >
            <circle r={16} fill={t('paper-raised')} stroke={t('ink-3')} />
            <path d="M0 -12 L5 6 L0 2 L-5 6 Z" fill={t('ink')} />
            <text y={-18} textAnchor="middle" fontSize={10} fill={t('ink')}>
              N
            </text>
            {sun.up ? (
              <circle
                cx={Math.sin((sun.azimuthDeg * Math.PI) / 180) * 16}
                cy={-Math.cos((sun.azimuthDeg * Math.PI) / 180) * 16}
                r={4}
                fill={t('glow')}
              />
            ) : null}
          </g>
          <g transform={`translate(${vb[0]! + 16 / px} ${vb[1]! + vb[3]! - 104 / px})`}>
            <rect width={scale} height={3 / px} fill={t('ink')} />
            <text y={-5 / px} fontSize={10 / px} fill={t('ink')}>
              {scale} m
            </text>
          </g>
        </>
      )}
    </svg>
  );
}

function niceScale(m: number): number {
  const steps = [10, 20, 50, 100, 200, 500];
  return steps.filter((s) => s <= m).at(-1) ?? 10;
}
