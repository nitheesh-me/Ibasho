/**
 * EpcChip: the estimated EPC band letter (DESIGN_SYSTEM 8, SPEC 5.3, R3, R16, DEC SC-5).
 * Owner: WP-06.
 *
 * Always labelled "Estimated EPC", never "EPC". Until the band confusion matrix passes (AC-R1)
 * the chip always shows the band either side (F7): the caller sets `bandValidated` only then.
 * Letters belong to this chip alone; the Ibasho score never shows one (DEC PR-4).
 *
 * DOM: `.ib-epc[data-band][data-spread]`; a button when it has evidence to open.
 */
import { BANDS, type Band, type EvidenceId } from '@ibasho/core';
import { useRef } from 'react';
import { useEvidenceSource } from '../evidence/context.tsx';

export interface EpcChipProps {
  band: Band;
  /** Evidence node of the band (rating run), opened on activation. */
  ev?: EvidenceId;
  /** Set only once AC-R1 passes. Until then the spread is always shown. */
  bandValidated?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** The band and its neighbours, the spread shown until AC-R1 passes. */
export function epcSpread(band: Band): { lo: Band; hi: Band } {
  const i = BANDS.indexOf(band);
  return { lo: BANDS[Math.max(0, i - 1)] as Band, hi: BANDS[Math.min(BANDS.length - 1, i + 1)] as Band };
}

export function epcLabel(band: Band, validated: boolean): string {
  if (validated) return `Estimated EPC band ${band}`;
  const { lo, hi } = epcSpread(band);
  return `Estimated EPC band ${band}, could be ${lo} to ${hi}`;
}

export function EpcChip({ band, ev, bandValidated = false, size = 'md', className }: EpcChipProps) {
  const src = useEvidenceSource();
  const ref = useRef<HTMLButtonElement>(null);
  const spread = bandValidated ? undefined : epcSpread(band);
  const name = epcLabel(band, bandValidated);
  const i = BANDS.indexOf(band);

  const body = (
    <>
      <span className="ib-epc__label" aria-hidden="true">
        Estimated EPC
      </span>
      <span className="ib-epc__main" aria-hidden="true">
        <span className="ib-epc__letter">{band}</span>
        {spread ? (
          <span className="ib-epc__spread">
            could be {spread.lo} to {spread.hi}
          </span>
        ) : null}
      </span>
      <span className="ib-epc__scale" aria-hidden="true">
        {BANDS.map((b, j) => (
          <span
            key={b}
            className="ib-epc__cell"
            data-on={j === i ? '' : undefined}
            data-near={spread && Math.abs(j - i) === 1 ? '' : undefined}
          />
        ))}
      </span>
    </>
  );

  const cls = ['ib-epc', className].filter(Boolean).join(' ');
  if (ev) {
    return (
      <button
        ref={ref}
        type="button"
        className={cls}
        data-band={band}
        data-spread={spread ? '' : undefined}
        data-size={size}
        data-ev={ev}
        aria-label={`${name}. Open evidence.`}
        onClick={() => {
          if (ref.current) src.open?.(ev, ref.current);
        }}
      >
        {body}
      </button>
    );
  }
  return (
    <span
      className={cls}
      data-band={band}
      data-spread={spread ? '' : undefined}
      data-size={size}
      role="img"
      aria-label={name}
    >
      {body}
    </span>
  );
}
