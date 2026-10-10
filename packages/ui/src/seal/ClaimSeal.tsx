/**
 * ClaimSeal (DESIGN_SYSTEM 8, SPEC 7.3). Owner: WP-06.
 * A Proved claim in a sentence: a large hanko, the claim, what it does not prove, and doors to
 * the theorems and the certificate. The only place a Proved seal appears.
 *
 * Copy comes from the caller (the app reads `@ibasho/spec-gen` `seals.json`), so the claim
 * sentence, theorems and "not proved" line stay generated from Lean.
 */
import type { ClaimId } from '@ibasho/core';
import { useId } from 'react';
import { Seal } from './Seal.tsx';

export interface ClaimSealProps {
  claim: {
    id: ClaimId;
    /** "Nothing better is hidden". */
    sentence: string;
    /** Lean theorem names behind the claim. */
    theorems: readonly string[];
    /** What the claim does not prove (the text after "Not proved: "). */
    notProved: string;
  };
  /** Optional longer statement, e.g. "Proved: no option that passes our rules beats these ...". */
  statement?: string;
  /** Where "See the proof" goes (`/app/proofs#<claim>`). */
  proofHref?: string;
  /** Where "See the certificate" goes. */
  certificateHref?: string;
  /** Play the hanko press on mount (Reveal). */
  press?: boolean;
  /** `card` is a raised sheet; `inline` sits in running text and panels. */
  variant?: 'card' | 'inline';
  className?: string;
}

export function ClaimSeal({
  claim,
  statement,
  proofHref,
  certificateHref,
  press = false,
  variant = 'card',
  className,
}: ClaimSealProps) {
  const titleId = useId();
  const noteId = useId();
  return (
    <section
      className={['ib-claim', variant === 'card' ? 'ib-washi' : undefined, className]
        .filter(Boolean)
        .join(' ')}
      data-variant={variant}
      data-claim={claim.id}
      aria-labelledby={titleId}
      aria-describedby={noteId}
    >
      <div className="ib-claim__seal">
        <Seal
          level="proved"
          claim={{ id: claim.id, sentence: claim.sentence }}
          notProved={claim.notProved}
          size={variant === 'card' ? 'xl' : 'lg'}
          press={press}
        />
      </div>
      <div className="ib-claim__body">
        <p className="ib-claim__kicker">Proved claim</p>
        <h3 className="ib-claim__sentence" id={titleId}>
          {claim.sentence}
        </h3>
        {statement ? <p className="ib-claim__statement">{statement}</p> : null}
        <p className="ib-claim__not" id={noteId}>
          <strong>Not proved:</strong> {claim.notProved}
        </p>
        <footer className="ib-claim__foot">
          <ul className="ib-claim__theorems" aria-label="Lean theorems">
            {claim.theorems.map((t) => (
              <li key={t}>
                <code>{t}</code>
              </li>
            ))}
          </ul>
          {proofHref || certificateHref ? (
            <nav className="ib-claim__links" aria-label="Evidence for this claim">
              {proofHref ? <a href={proofHref}>See the proof</a> : null}
              {certificateHref ? <a href={certificateHref}>See the certificate</a> : null}
            </nav>
          ) : null}
        </footer>
      </div>
    </section>
  );
}
