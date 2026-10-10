/**
 * `a11y-scene` outline model (ARCH 10, SPEC 5.3 AC-H1): a DOM tree generated from the twin and
 * the scene quantities. Every element and junction the scene draws has an item, and every item
 * names something the scene draws. Pure, so the parity test needs no DOM. Owner: WP-07.
 */
import type { Element, HomeTwin, JunctionKind } from '@ibasho/core';
import type { SceneQuantities } from '../quantities/types.ts';
import type { SceneTarget } from '../select/store.ts';

export interface OutlineItem {
  target: SceneTarget;
  label: string;
  /** One sentence for screen readers: state, value, loss at the named condition. */
  description: string;
  children: OutlineItem[];
}

export interface OutlineGroup {
  id: 'envelope' | 'junctions' | 'zones';
  label: string;
  items: OutlineItem[];
}

const KIND: Record<Element['kind'], string> = {
  wall: 'Wall',
  'party-wall': 'Party wall',
  roof: 'Roof',
  floor: 'Floor',
  window: 'Window',
  door: 'Door',
  rooflight: 'Rooflight',
};

const JKIND: Record<JunctionKind, string> = {
  lintel: 'Lintel',
  sill: 'Sill',
  jamb: 'Jamb',
  eaves: 'Eaves',
  'ground-floor': 'Ground floor edge',
  'party-wall': 'Party wall edge',
  'intermediate-floor': 'Floor edge',
  corner: 'Corner',
  'joist-end': 'Joist ends',
};

const PREFIX = /^(wall|party|win|window|door|roof|floor|rooflight|jn)-/;

/** "win-front-bay" to "Window (front bay)". */
export function elementLabel(e: Pick<Element, 'id' | 'kind'>): string {
  const rest = e.id.replace(PREFIX, '').replace(/-/g, ' ').trim();
  return rest ? `${KIND[e.kind]} (${rest})` : KIND[e.kind];
}

const r1 = (x: number): string => (Math.round(x * 10) / 10).toString();
const r0 = (x: number): string => Math.round(x).toLocaleString('en-GB');

function fieldState(e: Element): string {
  return e.u.state === 'known' ? 'Known' : e.u.state === 'estimated' ? 'Estimated' : 'Unknown';
}

export function buildOutline(twin: HomeTwin, q: SceneQuantities): OutlineGroup[] {
  const flows = new Map(q.elements.map((f) => [f.elementId, f]));
  const cond = q.condition.label;
  const describe = (e: Element): string => {
    const f = flows.get(e.id);
    const u = f ? `U ${r1(f.u)} W/m²K` : 'U not available';
    const loss = f ? `, heat loss ${r0(f.watts)} W on ${cond}` : '';
    return `${fieldState(e)} ${u}${loss}. Modelled, not measured.`;
  };
  const item = (e: Element): OutlineItem => ({
    target: { kind: 'element', id: e.id },
    label: elementLabel(e),
    description: describe(e),
    children: twin.elements.filter((c) => c.parentId === e.id).map(item),
  });
  const top = twin.elements.filter((e) => !e.parentId || !twin.elements.some((p) => p.id === e.parentId));
  const order: Element['kind'][] = ['roof', 'wall', 'party-wall', 'floor', 'window', 'door', 'rooflight'];
  top.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  const jflows = new Map(q.junctions.map((j) => [j.junctionId, j]));
  const junctions: OutlineItem[] = twin.junctions.map((j) => {
    const f = jflows.get(j.id);
    const rest = j.id.replace(/^jn-/, '').replace(/-/g, ' ');
    return {
      target: { kind: 'junction', id: j.id },
      label: `${JKIND[j.kind]} (${rest})`,
      description: f
        ? `psi ${f.psi} W/mK over ${r1(f.lengthM)} m, ${r0(f.watts)} W on ${cond}. Modelled, not measured.`
        : 'No value yet.',
      children: [],
    };
  });

  const zones: OutlineItem[] = q.zones.map((z) => ({
    target: { kind: 'zone', id: z.zone },
    label: z.zone === 'living' ? 'Living area (zone)' : 'Rest of home (zone)',
    description: `Zone temperature ${r1(z.tempC)} °C on ${cond}. Modelled, not measured.`,
    children: [],
  }));

  return [
    { id: 'envelope', label: 'Walls, roof, floor and openings', items: top.map(item) },
    { id: 'junctions', label: 'Junctions (thermal bridges)', items: junctions },
    { id: 'zones', label: 'Zones', items: zones },
  ];
}

/** Flat list of targets in outline order (AC-H1 and keyboard order). */
export function outlineTargets(groups: readonly OutlineGroup[]): SceneTarget[] {
  const out: SceneTarget[] = [];
  const walk = (it: OutlineItem): void => {
    out.push(it.target);
    it.children.forEach(walk);
  };
  for (const g of groups) g.items.forEach(walk);
  return out;
}
