/**
 * Layer legends (AC-15, DESIGN_SYSTEM 10 honesty rules): always visible while the layer shows,
 * naming the unit, the condition and "Modelled, not measured". DOM, styled with Andon tokens.
 * Owner: WP-07.
 */
import type { CSSProperties, ReactNode } from 'react';
import { NETSU_RANGE, netsuGradientCss } from '../colour/palette.ts';
import { type SceneQuantities, totalFabricW, WATTS_PER_MOTE } from '../quantities/types.ts';
import { MAX_MOTES } from './HeatFlow.tsx';
import { moteCount } from './motes.ts';

const BOX: CSSProperties = {
  font: '500 12px/1.4 var(--font-sans, system-ui, sans-serif)',
  color: 'var(--text, #26221f)',
  background: 'color-mix(in oklch, var(--surface-raised, #faf6ef) 92%, transparent)',
  border: '1px solid var(--rule, #c6c2b6)',
  borderRadius: 6,
  padding: '8px 10px',
  maxWidth: 260,
  boxShadow: '0 1px 0 var(--rule, #c6c2b6)',
};
const NOTE: CSSProperties = { color: 'var(--text-2, #4f4944)', fontSize: 11, marginTop: 4 };

const r0 = (x: number): string => Math.round(x).toLocaleString('en-GB');

export function LegendBox({ title, children, label }: { title: string; children: ReactNode; label: string }) {
  return (
    <figure className="ib-legend" aria-label={label} style={{ ...BOX, margin: 0 }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 4 }}>{title}</figcaption>
      {children}
    </figure>
  );
}

function SourceNote({ q }: { q: SceneQuantities }) {
  return (
    <div style={NOTE}>
      Modelled, not measured.
      {q.source === 'twin-fixture' ? ' Placeholder values from your inputs until the engine has run.' : null}
    </div>
  );
}

export function HeatFlowLegendView({ q, night }: { q: SceneQuantities; night: boolean }) {
  const fabric = totalFabricW(q);
  const motes =
    q.elements.reduce((s, e) => s + moteCount(e.watts), 0) +
    q.junctions.reduce((s, j) => s + moteCount(j.watts), 0) +
    q.leaks.reduce((s, l) => s + moteCount(l.watts), 0);
  const capped = motes > MAX_MOTES;
  return (
    <LegendBox title="Where the heat goes" label="Heat flow legend">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden="true"
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: night ? 'var(--glow, #ffb547)' : 'var(--ember, #d57835)',
            display: 'inline-block',
          }}
        />
        <span>One mote is {WATTS_PER_MOTE} W of heat leaving.</span>
      </div>
      <div>
        Through walls, roof, floor and openings: {r0(fabric)} W. Through air leaks: {r0(q.ventilationW)} W.
      </div>
      <div style={NOTE}>On {q.condition.label}.</div>
      {capped ? <div style={NOTE}>Too many motes to draw; showing the first {r0(MAX_MOTES)}.</div> : null}
      <SourceNote q={q} />
    </LegendBox>
  );
}

export function RampBar({ lo, hi }: { lo: number; hi: number }) {
  return (
    <div>
      <div
        aria-hidden="true"
        style={{ height: 10, borderRadius: 3, background: netsuGradientCss(), border: '1px solid var(--rule, #c6c2b6)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>{lo} °C</span>
        <span>{(lo + hi) / 2} °C</span>
        <span>{hi} °C</span>
      </div>
    </div>
  );
}

export function LensLegendView({ q }: { q: SceneQuantities }) {
  return (
    <LegendBox title="Thermal lens" label="Thermal lens legend">
      <RampBar lo={NETSU_RANGE.lo} hi={NETSU_RANGE.hi} />
      <div style={NOTE}>
        Surface temperatures on {q.condition.label}, inside at {q.condition.thetaInC} °C. Bright lines are thermal
        bridges: brighter means more watts per metre. Drag the lens, or move it with the arrow keys.
      </div>
      <SourceNote q={q} />
    </LegendBox>
  );
}

export function ZoneLegendView({ q }: { q: SceneQuantities }) {
  const name = (z: string): string => (z === 'living' ? 'Living area' : 'Rest of home');
  return (
    <LegendBox title="Zone temperatures" label="Zone temperature legend">
      <RampBar lo={NETSU_RANGE.lo} hi={NETSU_RANGE.hi} />
      <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0' }}>
        {q.zones.map((z) => (
          <li key={z.zone}>
            {name(z.zone)} (zone): {Math.round(z.tempC * 10) / 10} °C
          </li>
        ))}
      </ul>
      <div style={NOTE}>Each tint is the whole zone, not a single room. On {q.condition.label}.</div>
      <SourceNote q={q} />
    </LegendBox>
  );
}
