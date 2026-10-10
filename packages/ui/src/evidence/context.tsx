/**
 * Where `Num` finds its evidence (ARCH 7). Owner: WP-06.
 *
 * `ui` is layer L2 and cannot import the store or the engine, so the app (WP-08) provides an
 * `EvidenceSource`: a lookup from evidence id to node, and what to do when a number is opened
 * (draw the red thread and open the drawer). Without a provider every lookup misses and `Num`
 * renders its "evidence missing" state instead of a bare number.
 */
import type { EvidenceId, EvidenceNode } from '@ibasho/core';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

export interface EvidenceSource {
  node(id: EvidenceId): EvidenceNode | undefined;
  /** Open the evidence drawer for `id`; `from` is the chip, where the red thread starts. */
  open?(id: EvidenceId, from: HTMLElement): void;
  /** BCP 47 locale for number formatting. Default `en-GB`. */
  locale?: string;
}

const EMPTY: EvidenceSource = { node: () => undefined };
const Ctx = createContext<EvidenceSource>(EMPTY);

export function EvidenceProvider({ source, children }: { source: EvidenceSource; children: ReactNode }) {
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>;
}

export function useEvidenceSource(): EvidenceSource {
  return useContext(Ctx);
}

/** A source over a list or map of nodes (stories, tests, fixtures). */
export function useStaticEvidence(
  nodes: Iterable<EvidenceNode>,
  open?: EvidenceSource['open'],
  locale?: string,
): EvidenceSource {
  return useMemo(() => staticEvidence(nodes, open, locale), [nodes, open, locale]);
}

export function staticEvidence(
  nodes: Iterable<EvidenceNode>,
  open?: EvidenceSource['open'],
  locale?: string,
): EvidenceSource {
  const byId = new Map<EvidenceId, EvidenceNode>();
  for (const n of nodes) byId.set(n.id, n);
  const src: EvidenceSource = { node: (id) => byId.get(id) };
  if (open) src.open = open;
  if (locale) src.locale = locale;
  return src;
}
