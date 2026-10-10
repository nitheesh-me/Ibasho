/**
 * Home stage view model (SPEC 5.3, 5.7 at M-0). Owner: WP-08.
 *
 * Pure: turns a `SearchResult` and the mirror's verdict into what the page shows. Every figure is
 * an evidence id for `Num`; this file never formats a number.
 */
import { guidanceFor } from '@ibasho/content';
import type { EvidenceId, EvidenceNode, SearchResult } from '@ibasho/core';
import { measureOfOption } from '@ibasho/pack-home-uk/ids';
import { SPEC_GEN_IS_PLACEHOLDER } from '@ibasho/spec-gen';
import seals from '@ibasho/spec-gen/seals.json' with { type: 'json' };

export type PickKey = 'leastUpfront' | 'bestReturn' | 'lowestRunningCarbon';

/** Fixed order and names (DS 8 `Futures`, DS 9). */
export const PICKS: readonly { key: PickKey; title: string }[] = [
  { key: 'leastUpfront', title: 'Least upfront' },
  { key: 'bestReturn', title: 'Best return' },
  { key: 'lowestRunningCarbon', title: 'Lowest running carbon' },
];

/** The four figures per future card, all bookkeeping quantities the checker re-derives. */
export const FIGURES: readonly { quantity: string; label: string; delta?: 'saving' }[] = [
  { quantity: 'fin.n0', label: 'Upfront, after grants' },
  { quantity: 'money.bill_saving', label: 'Off your bills each year', delta: 'saving' },
  { quantity: 'acct.carbon_saving', label: 'Carbon saved each year', delta: 'saving' },
  { quantity: 'fin.npv', label: 'Worth over the years, in today’s money' },
];

export interface FigureView {
  label: string;
  ev: EvidenceId;
  delta?: 'saving';
}

export interface PickView {
  key: PickKey;
  title: string;
  packageId: string;
  /** Plain measure names, for example "Draught-proofing and Loft insulation top-up". */
  name: string;
  figures: FigureView[];
  /** Set when an earlier card already shows the same package. */
  sameAs?: string;
}

export interface LaneView {
  packageId: string;
  name: string;
  reason: string;
}

export interface ClaimView {
  id: string;
  sentence: string;
  theorems: string[];
  notProved: string;
}

export interface HomeView {
  picks: PickView[];
  lane: LaneView[];
  /** The mirror re-derived every row and agreed, and the spec is the real generated one. */
  checked: boolean;
  /** Proved claims shown on the page (only with a real spec). */
  claims: ClaimView[];
}

/** Plain reasons for rules that put a package in the "possible after a check" lane. */
const CHECK_REASONS: Record<string, string> = {
  'UK.DNO.HP.LOOPED':
    'Needs the network operator to approve it first: we do not know if your electricity supply is shared with a neighbour.',
};

export function packageName(packageId: string): string {
  if (packageId === 'baseline') return 'No change';
  const names = packageId.split('+').map((o) => {
    const m = measureOfOption(o);
    return (m && guidanceFor(m)?.name) || o;
  });
  return names.map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1))).join(' and ');
}

function findNode(
  nodes: readonly EvidenceNode[],
  packageId: string,
  quantity: string,
): EvidenceNode | undefined {
  return nodes.find((n) => n.subject.packageId === packageId && n.quantity === quantity);
}

/** Proved claims the M-0 page states; the rest arrive with their screens. */
const M0_CLAIMS = ['rejected-never-returned'];

export function homeView(result: SearchResult, mirrorOk: boolean): HomeView {
  const ids = result.packages.ids;
  const picks: PickView[] = [];
  for (const { key, title } of PICKS) {
    const row = result.picks[key];
    if (row === undefined) continue;
    const packageId = ids[row];
    if (!packageId) continue;
    const figures: FigureView[] = [];
    for (const f of FIGURES) {
      const node = findNode(result.graph.nodes, packageId, f.quantity);
      if (node) figures.push({ label: f.label, ev: node.id, ...(f.delta ? { delta: f.delta } : {}) });
    }
    const earlier = picks.find((p) => p.packageId === packageId);
    picks.push({
      key,
      title,
      packageId,
      name: packageName(packageId),
      figures,
      ...(earlier ? { sameAs: earlier.title } : {}),
    });
  }

  const lane: LaneView[] = [...result.needsCheck].map((row) => {
    const packageId = ids[row] ?? '';
    const rules = result.packages.ruleIds[row] ?? [];
    const reason =
      rules.map((r) => CHECK_REASONS[r]).find(Boolean) ?? 'Needs a check before we can offer it.';
    return { packageId, name: packageName(packageId), reason };
  });

  const real = !SPEC_GEN_IS_PLACEHOLDER;
  const claims: ClaimView[] = real
    ? seals.claims
        .filter((c) => M0_CLAIMS.includes(c.id))
        .map((c) => ({
          id: c.id,
          sentence: c.sentence,
          theorems: c.theorems.map((t) => t.name),
          notProved: c.notProved,
        }))
    : [];
  return { picks, lane, checked: real && mirrorOk, claims };
}
