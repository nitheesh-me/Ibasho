/**
 * Seal (Hanko) (DESIGN_SYSTEM 8, SPEC R11). Owner: WP-06. The only consumer of `--seal`.
 *
 * Levels: Proved (claims only), Checked (with rung and coverage), Modelled, Cracked
 * ("Check failed"), Unverified rule, and Pressing (a check in flight). Every seal carries its
 * one line "Not proved: ..." and exposes it to screen readers through `aria-describedby`; it
 * shows on hover and focus.
 *
 * Proved is unrepresentable without a claim: the `proved` variant requires `claim`, and `Num`
 * only accepts `NumberSeal`, which has no `proved` member (F6).
 */
import type { ClaimId } from '@ibasho/core';
import { type CSSProperties, useId } from 'react';
import {
  type CheckInfo,
  checkDetail,
  NOT_PROVED,
  type NumberSeal,
  notProvedLine,
  SEAL_LABEL,
  type SealKind,
} from './copy.ts';
import { SealMark, type SealSize, sealSeed } from './SealMark.tsx';

interface SealCommon {
  size?: SealSize;
  /** Show the label ("Checked by Lean, every row") beside the mark. */
  showLabel?: boolean;
  /** Override the default "Not proved" body (the text after "Not proved: "). */
  notProved?: string;
  /** Seeds the print (tilt and ink texture). Defaults to the level. */
  seed?: string;
  /** Play the hanko press when the seal mounts. */
  press?: boolean;
  className?: string;
}

export interface NumberSealProps extends SealCommon {
  level: NumberSeal;
  check?: CheckInfo;
}

export interface ClaimRef {
  id: ClaimId;
  /** The plain sentence, e.g. "Nothing better is hidden". */
  sentence: string;
}

export interface ProvedSealProps extends SealCommon {
  level: 'proved';
  /** Proved sits on claims only (SPEC R11). */
  claim: ClaimRef;
  /** Required for Proved: every claim names what it does not prove. */
  notProved: string;
}

export type SealProps = NumberSealProps | ProvedSealProps;

/** Accessible name: "Checked by Lean, every row" or "Proved: Nothing better is hidden". */
export function sealName(props: SealProps): string {
  if (props.level === 'proved') return `${SEAL_LABEL.proved}: ${props.claim.sentence}`;
  const detail = props.level === 'checked' ? checkDetail(props.check) : undefined;
  return detail ? `${SEAL_LABEL[props.level]} ${detail}` : SEAL_LABEL[props.level];
}

export function sealNote(props: SealProps): string {
  return notProvedLine(props.notProved ?? NOT_PROVED[props.level as NumberSeal]);
}

/** A seal's print tilt in degrees, seeded: real hanko never land square. */
export function sealTilt(kind: SealKind, seed: string): number {
  if (kind === 'modelled' || kind === 'unverified') return 0;
  const h = sealSeed(seed);
  return Math.round(((h % 1000) / 1000 - 0.62) * 70) / 10; // about -4.3 to +2.7 degrees
}

export function Seal(props: SealProps) {
  const { size = 'md', showLabel = false, press = false, className } = props;
  const noteId = useId();
  const kind: SealKind = props.level;
  const seed = props.seed ?? (props.level === 'proved' ? props.claim.id : kind);
  const name = sealName(props);
  const style = { '--ib-seal-tilt': `${sealTilt(kind, seed)}deg` } as CSSProperties;
  return (
    <span
      className={['ib-seal', className].filter(Boolean).join(' ')}
      data-seal={kind}
      data-size={size}
      data-press={press ? '' : undefined}
      role="img"
      aria-label={name}
      aria-describedby={noteId}
      // Focusable so keyboard users can reveal the "Not proved" line (WCAG 1.4.13, DS 8).
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the seal is a toggletip host
      tabIndex={0}
      style={style}
    >
      <span className="ib-seal__print">
        <SealMark kind={kind} size={size} seed={sealSeed(seed)} />
      </span>
      {showLabel ? (
        <span className="ib-seal__label" aria-hidden="true">
          {name}
        </span>
      ) : null}
      <span id={noteId} role="tooltip" className="ib-seal__note">
        {sealNote(props)}
      </span>
    </span>
  );
}
