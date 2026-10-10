/**
 * T1 visual-layer plugins (ARCH 5.6, 10): heat-flow, thermal-lens, zone-tint. Each encodes
 * numbers, so each declares a `Legend` and `evidenceAt` (AC-15), a reduced-motion variant
 * (G6) and a draw budget (AC-PERF). Owner: WP-07.
 */
import type { LayerProps, LegendProps, VisualLayerPlugin } from '@ibasho/core';
import { useMemo } from 'react';
import { cameraBasis, projectOrtho } from '../camera/model.ts';
import { netsuHex, tempToT } from '../colour/palette.ts';
import { useSceneData } from '../three/context.tsx';
import { evidenceForHit } from './evidence.ts';
import { HeatFlowMotes, MAX_MOTES } from './HeatFlow.tsx';
import { HeatFlowLegendView, LensLegendView, ZoneLegendView } from './legends.tsx';
import { buildMotes } from './motes.ts';
import { ThermalLens } from './ThermalLens.tsx';
import { ZoneTint } from './ZoneTint.tsx';

function HeatFlowOverlay(p: LayerProps) {
  const d = useSceneData();
  return (
    <HeatFlowMotes
      house={d.house}
      quantities={d.quantities}
      reducedMotion={p.reducedMotion}
      night={d.theme === 'yoru'}
      store={d.store}
    />
  );
}
function HeatFlowStill(_p: LayerProps) {
  const d = useSceneData();
  return <HeatFlowMotes house={d.house} quantities={d.quantities} reducedMotion night={d.theme === 'yoru'} store={d.store} />;
}
function HeatFlowSvg(_p: LayerProps) {
  const d = useSceneData();
  const dots = useMemo(() => {
    const f = buildMotes(d.house, d.quantities);
    const basis = cameraBasis(d.camera);
    const out: { x: number; y: number; c: string }[] = [];
    for (let i = 0; i < Math.min(f.count, MAX_MOTES); i++) {
      const k = 0.25 + 0.6 * f.params[i * 4]!;
      const q = projectOrtho(
        d.camera,
        [
          f.origins[i * 3]! + f.dirs[i * 3]! * k,
          f.origins[i * 3 + 1]! + f.dirs[i * 3 + 1]! * k,
          f.origins[i * 3 + 2]! + f.dirs[i * 3 + 2]! * k,
        ],
        basis,
      );
      out.push({ x: q.x, y: q.y, c: netsuHex(f.params[i * 4 + 2]!) });
    }
    return out;
  }, [d.house, d.quantities, d.camera]);
  return (
    <g className="ib-svg-motes" aria-hidden="true">
      {dots.map((m, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: motes are positional and never reorder
        <circle key={i} cx={m.x} cy={m.y} r={2.4} fill={m.c} opacity={0.85} />
      ))}
    </g>
  );
}
function HeatFlowLegend(_p: LegendProps) {
  const d = useSceneData();
  return <HeatFlowLegendView q={d.quantities} night={d.theme === 'yoru'} />;
}

function LensOverlay(_p: LayerProps) {
  const d = useSceneData();
  return <ThermalLens house={d.house} composed={d.composed} quantities={d.quantities} lens={d.lens} />;
}
function LensLegend(_p: LegendProps) {
  const d = useSceneData();
  return <LensLegendView q={d.quantities} />;
}

function ZoneOverlay(_p: LayerProps) {
  const d = useSceneData();
  return <ZoneTint house={d.house} quantities={d.quantities} />;
}
function ZoneSvg(_p: LayerProps) {
  const d = useSceneData();
  const basis = cameraBasis(d.camera);
  const temps = new Map(d.quantities.zones.map((z) => [z.zone, z.tempC]));
  return (
    <g className="ib-svg-zones" aria-hidden="true">
      {d.house.rooms.map((r) => {
        const pts: [number, number, number][] = [
          [r.min[0], r.min[1] + 0.02, r.min[2]],
          [r.max[0], r.min[1] + 0.02, r.min[2]],
          [r.max[0], r.min[1] + 0.02, r.max[2]],
          [r.min[0], r.min[1] + 0.02, r.max[2]],
        ];
        const d2 = `${pts
          .map((p, i) => {
            const q = projectOrtho(d.camera, p, basis);
            return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
          })
          .join(' ')} Z`;
        return <path key={r.id} d={d2} fill={netsuHex(tempToT(temps.get(r.zone) ?? 18))} opacity={0.45} />;
      })}
    </g>
  );
}
function ZoneLegend(_p: LegendProps) {
  const d = useSceneData();
  return <ZoneLegendView q={d.quantities} />;
}

export const heatFlowLayer: VisualLayerPlugin = {
  kind: 'visual-layer',
  id: 'scene.heat-flow',
  version: '1.0.0',
  title: 'scene.layer.heat-flow',
  side: 'ui',
  layerId: 'heat-flow',
  quantities: ['fabric.u.*', 'geom.area.*', 'fabric.psi.*', 'geom.len.*', 'vent.hve.*'],
  encodesNumbers: true,
  Overlay: HeatFlowOverlay,
  ReducedMotion: HeatFlowStill,
  Svg: HeatFlowSvg,
  Legend: HeatFlowLegend,
  evidenceAt: (hit, res) => evidenceForHit(hit, res),
  budget: { drawCalls: 1, triangles: 0, particles: MAX_MOTES },
};

export const thermalLensLayer: VisualLayerPlugin = {
  kind: 'visual-layer',
  id: 'scene.thermal-lens',
  version: '1.0.0',
  title: 'scene.layer.thermal-lens',
  side: 'ui',
  layerId: 'thermal-lens',
  quantities: ['fabric.u.*', 'fabric.psi.*', 'geom.len.*'],
  encodesNumbers: true,
  Overlay: LensOverlay,
  ReducedMotion: LensOverlay,
  Legend: LensLegend,
  evidenceAt: (hit, res) => evidenceForHit(hit, res),
  budget: { drawCalls: 90, triangles: 4000 },
};

export const zoneTintLayer: VisualLayerPlugin = {
  kind: 'visual-layer',
  id: 'scene.zone-tint',
  version: '1.0.0',
  title: 'scene.layer.zone-tint',
  side: 'ui',
  layerId: 'zone-tint',
  quantities: ['thermal.zone.living', 'thermal.zone.rest'],
  encodesNumbers: true,
  Overlay: ZoneOverlay,
  ReducedMotion: ZoneOverlay,
  Svg: ZoneSvg,
  Legend: ZoneLegend,
  evidenceAt: (hit, res) => evidenceForHit(hit, res),
  budget: { drawCalls: 12, triangles: 200 },
};

export const T1_LAYERS: readonly VisualLayerPlugin[] = [heatFlowLayer, thermalLensLayer, zoneTintLayer];
