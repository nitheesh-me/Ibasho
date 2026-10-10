/**
 * Num: the only way to render a number (ARCH 1 rule 3, DESIGN_SYSTEM 8). Owner: WP-06.
 *
 * `<Num ev={id} />` looks the evidence node up in the nearest `EvidenceProvider`, formats it by
 * unit and rounding policy, and renders an evidence chip: tabular M PLUS 1 Code digits, the unit
 * in `--text-2` one step smaller, and the number's seal (Checked, Modelled, Cracked, Unverified or
 * Pressing, never Proved). Activating the chip asks the source to open the evidence drawer.
 *
 * DOM contract (M0-5, AC-E1): the chip carries `data-num` and `data-ev`; every digit on a screen
 * lives inside one. A missing node renders a marked chip with no digits, never a bare number.
 */
import type { EvidenceId } from '@ibasho/core';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useEvidenceSource } from '../evidence/context.tsx';
import { NOT_PROVED, type NumberSeal, notProvedLine } from '../seal/copy.ts';
import { sealName } from '../seal/Seal.tsx';
import { SealMark, sealSeed } from '../seal/SealMark.tsx';
import { type DisplayAs, type Formatted, formatEvidence } from './format.ts';

export interface NumProps {
  ev: EvidenceId;
  /**
   * Seal override for the recompute sequence (crack and re-press). Defaults to the node's seal,
   * which `verify` assigns. `proved` is not a member: numbers are never Proved (F6).
   */
  seal?: NumberSeal;
  /** Show `+` on positive values. Use for deltas. */
  signed?: boolean;
  /** Saving or increase colouring for deltas; always paired with the sign. */
  delta?: 'saving' | 'increase';
  /** Show the value in another unit of the same quantity (`MWh`, `tCO2e`). */
  as?: DisplayAs;
  /** Visual size. `display` is the score numeral. */
  size?: 'ui' | 'body' | 'display';
  className?: string;
}

export function Num({ ev, seal, signed, delta, as, size = 'body', className }: NumProps) {
  const src = useEvidenceSource();
  const node = src.node(ev);
  const noteId = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const cls = ['ib-num', className].filter(Boolean).join(' ');

  let f: Formatted | undefined;
  let error: string | undefined;
  if (node) {
    try {
      f = formatEvidence(node, {
        ...(src.locale ? { locale: src.locale } : {}),
        ...(signed ? { signed } : {}),
        ...(as ? { as } : {}),
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  // Sumi bleed: when the drawn text changes after mount, the digits settle in again.
  const text = f?.text;
  const [generation, setGeneration] = useState(0);
  const last = useRef(text);
  useLayoutEffect(() => {
    if (last.current !== text) {
      last.current = text;
      setGeneration((g) => g + 1);
    }
  }, [text]);

  if (!node || !f) {
    const why = error ? 'Evidence could not be shown' : 'Evidence missing';
    return (
      <span
        className={cls}
        data-num=""
        data-ev={ev}
        data-missing=""
        data-size={size}
        role="img"
        aria-label={why}
      >
        <span className="ib-num__value" aria-hidden="true">
          {'···'}
        </span>
      </span>
    );
  }

  const level: NumberSeal = seal ?? node.seal;
  const check = level === 'checked' && node.check ? node.check : undefined;
  const sealLabel = sealName(check ? { level, check } : { level });
  const label = `${f.spoken}. ${sealLabel}. Open evidence.`;

  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      data-num=""
      data-ev={ev}
      data-seal={level}
      data-size={size}
      data-delta={delta}
      data-sign={f.sign}
      aria-label={label}
      aria-describedby={noteId}
      onClick={() => {
        if (ref.current) src.open?.(ev, ref.current);
      }}
    >
      <span
        className="ib-num__value"
        aria-hidden="true"
        key={generation}
        data-settle={generation > 0 ? '' : undefined}
      >
        {f.parts.map((p, i) => (
          // Parts are positional and never reorder, so the index is a stable key.
          // biome-ignore lint/suspicious/noArrayIndexKey: positional parts
          <span key={i} className={`ib-num__${p.kind}`}>
            {p.kind === 'digits' ? withSeparators(p.text) : p.kind === 'unit' ? withDegree(p.text) : p.text}
          </span>
        ))}
      </span>
      <span className="ib-num__seal ib-seal" data-seal={level} data-size="glyph" aria-hidden="true">
        <span className="ib-seal__print">
          <SealMark kind={level} size="glyph" seed={sealSeed(ev)} />
        </span>
      </span>
      <span id={noteId} role="tooltip" className="ib-num__note">
        <span className="ib-num__note-level">{sealLabel}.</span> {notProvedLine(NOT_PROVED[level])}
      </span>
    </button>
  );
}

/** Wrap grouping and decimal separators so monospaced digits can close up around them. */
function withSeparators(text: string) {
  return text.split(/(\D)/).map((chunk, i) =>
    i % 2 === 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: positional chunks
      <span key={i} className="ib-num__sep">
        {chunk}
      </span>
    ) : (
      chunk
    ),
  );
}

function withDegree(text: string) {
  const i = text.indexOf('\u00b0');
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="ib-num__deg">{'\u00b0'}</span>
      {text.slice(i + 1)}
    </>
  );
}
