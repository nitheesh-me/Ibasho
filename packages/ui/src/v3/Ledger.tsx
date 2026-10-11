/**
 * Settings ledger rows (SPEC 24, UV 7, DESIGN_SYSTEM 13). Owner: WP-06.
 *
 * Each row: the setting in plain words, its control (a stepper for rates and levels, chips for a
 * pick from a list), the unit, an origin chip ("Your value", "TGSPDCL FY 2026-27", "Pack default"),
 * a grade badge, the scope, and "changes N numbers". The count is tool metadata (the stale set
 * size, AC-SET2), drawn in `code`. Values live in form controls, so no digit leaks outside `Num`.
 */
import type { Grade, SettingOrigin, SettingScope } from '@ibasho/core';
import { type ReactNode, useId } from 'react';
import { GradeBadge } from '../grade/GradeBadge.tsx';

export const ORIGIN_LABEL: Record<SettingOrigin, string> = {
  user: 'Your value',
  pack: 'Published value',
  preset: 'Preset',
  default: 'Typical value',
};

export const SCOPE_LABEL: Record<SettingScope, string> = {
  app: 'All places',
  place: 'This place',
  building: 'This building',
  scenario: 'This scenario',
};

export interface LedgerRowProps {
  label: string;
  hint?: string;
  unit?: string;
  origin: SettingOrigin;
  /** Source name for the origin chip, e.g. "TGSPDCL FY 2026-27". */
  source?: string;
  grade: Grade;
  scope: SettingScope;
  /** Stale set size if this changes; absent for render settings (R41: never a number change). */
  affects?: number;
  depth?: 'plain' | 'pro';
  /** True while an edit is pending (Apply or Cancel). */
  pending?: boolean;
  control: (id: string) => ReactNode;
  onReset?: () => void;
}

export function LedgerRow(p: LedgerRowProps) {
  const id = useId();
  return (
    <div className="ib-ledger" data-pending={p.pending ? '' : undefined} data-depth={p.depth}>
      <div className="ib-ledger__what">
        <label className="ib-ledger__label" htmlFor={id}>
          {p.label}
        </label>
        {p.hint ? <span className="ib-ledger__hint">{p.hint}</span> : null}
      </div>
      <div className="ib-ledger__control">
        {p.control(id)}
        {p.unit ? <span className="ib-ledger__unit">{p.unit}</span> : null}
      </div>
      <div className="ib-ledger__meta">
        <span className="ib-origin" data-origin={p.origin} title={p.source}>
          {p.origin === 'user' ? ORIGIN_LABEL.user : (p.source ?? ORIGIN_LABEL[p.origin])}
        </span>
        <GradeBadge grade={p.grade} />
        <span className="ib-ledger__scope">{SCOPE_LABEL[p.scope]}</span>
        {p.affects === undefined ? (
          <span className="ib-ledger__affects" data-none="">
            never changes a number
          </span>
        ) : (
          <span className="ib-ledger__affects">
            changes <code>{p.affects}</code> numbers
          </span>
        )}
        {p.onReset && p.origin === 'user' ? (
          <button type="button" className="ib-link" onClick={p.onReset}>
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface StepperProps {
  id: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  /** Decimal places shown in the field. */
  decimals?: number;
}

/** A number field with explicit step buttons (every gesture has a button). */
export function Stepper({ id, value, step, min, max, onChange, label, decimals = 0 }: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals))));
  return (
    <span className="ib-stepper">
      <button
        type="button"
        className="ib-stepper__btn"
        aria-label={`Less ${label}`}
        onClick={() => onChange(clamp(value - step))}
      >
        −
      </button>
      <input
        id={id}
        className="ib-stepper__field"
        type="number"
        inputMode="decimal"
        value={value.toFixed(decimals)}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(clamp(v));
        }}
      />
      <button
        type="button"
        className="ib-stepper__btn"
        aria-label={`More ${label}`}
        onClick={() => onChange(clamp(value + step))}
      >
        +
      </button>
    </span>
  );
}

export function ChoiceChips<T extends string>({
  id,
  value,
  choices,
  onChange,
  label,
}: {
  id: string;
  value: T;
  choices: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <fieldset className="ib-chips" id={id} aria-label={label}>
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          className="ib-chip"
          aria-pressed={c.value === value}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </fieldset>
  );
}
