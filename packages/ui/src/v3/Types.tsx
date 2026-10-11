/**
 * Building type cards (DESIGN_SYSTEM 13.4, SPEC 18.1 Type step, UV 2.3). Owner: WP-06.
 *
 * Eight cards, each with its mon and a 24 hour occupancy strip (weekday). The strip is drawn from
 * the type's typical schedule shape and is illustrative until the type packs (WP-18) supply the
 * sourced schedule; the caption says so. Colour is never used for type: mon and strip only.
 */
import type { BuildingTypeId } from '@ibasho/core';
import { Mon } from '../mon/Mon.tsx';
import type { MonId } from '../mon/set.ts';

export interface TypeInfo {
  id: BuildingTypeId;
  label: string;
  mon: MonId;
  blurb: string;
  /** 24 weekday occupancy fractions, 0 to 1 (shape only). */
  schedule: readonly number[];
}

const day = (on: number, off: number, peak = 1, night = 0.05): number[] =>
  Array.from({ length: 24 }, (_, h) => (h >= on && h < off ? peak : night));

export const TYPE_INFO: Record<BuildingTypeId, TypeInfo> = {
  office: {
    id: 'office',
    label: 'Office',
    mon: 'type-office',
    blurb: 'Desks, meeting rooms and a core. Busy by day.',
    schedule: day(9, 19).map((v, h) => (h === 13 ? 0.7 : v)),
  },
  hotel: {
    id: 'hotel',
    label: 'Hotel',
    mon: 'type-hotel',
    blurb: 'Guest rooms full at night, lobby and kitchen by day.',
    schedule: Array.from({ length: 24 }, (_, h) => (h < 8 || h >= 20 ? 0.85 : 0.35)),
  },
  education: {
    id: 'education',
    label: 'Education',
    mon: 'type-education',
    blurb: 'Classrooms, labs and a library. Term time matters.',
    schedule: day(8, 18).map((v, h) => (h === 12 ? 0.5 : v)),
  },
  hospital: {
    id: 'hospital',
    label: 'Hospital',
    mon: 'type-hospital',
    blurb: 'Wards around the clock, theatres and clinics by day.',
    schedule: Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 18 ? 1 : 0.7)),
  },
  lab: {
    id: 'lab',
    label: 'Lab',
    mon: 'type-lab',
    blurb: 'Fume cupboards and lots of fresh air, often with equipment running late.',
    schedule: day(8, 20, 0.9, 0.25),
  },
  apartments: {
    id: 'apartments',
    label: 'Apartments',
    mon: 'type-apartments',
    blurb: 'Many homes stacked; mornings and evenings.',
    schedule: Array.from({ length: 24 }, (_, h) => (h < 8 || h >= 18 ? 0.9 : 0.3)),
  },
  rental: {
    id: 'rental',
    label: 'Rental',
    mon: 'type-rental',
    blurb: 'A home someone else owns: who pays, who decides.',
    schedule: Array.from({ length: 24 }, (_, h) => (h < 8 || h >= 18 ? 0.9 : 0.4)),
  },
  'single-family': {
    id: 'single-family',
    label: 'Single family home',
    mon: 'type-single-family',
    blurb: 'One household, one roof.',
    schedule: Array.from({ length: 24 }, (_, h) => (h < 8 || h >= 17 ? 0.95 : 0.35)),
  },
};

export function ScheduleStrip({ values, label }: { values: readonly number[]; label: string }) {
  return (
    <svg className="ib-sched" viewBox="0 0 96 10" preserveAspectRatio="none" role="img" aria-label={label}>
      {values.map((v, h) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: hours are positional
          key={h}
          x={h * 4 + 0.4}
          y={10 - Math.max(1, v * 10)}
          width={3.2}
          height={Math.max(1, v * 10)}
          className="ib-sched__hour"
          opacity={0.25 + 0.75 * v}
        />
      ))}
    </svg>
  );
}

export interface TypeCardProps {
  type: BuildingTypeId;
  selected?: boolean;
  onSelect?: (type: BuildingTypeId) => void;
  /** Group name when cards act as a radio group. */
  name?: string;
}

export function TypeCard({ type, selected = false, onSelect }: TypeCardProps) {
  const t = TYPE_INFO[type];
  return (
    <button
      type="button"
      className="ib-typecard"
      data-type={type}
      aria-pressed={selected}
      onClick={() => onSelect?.(type)}
    >
      <Mon id={t.mon} size={48} className="ib-typecard__mon" />
      <span className="ib-typecard__label">{t.label}</span>
      <span className="ib-typecard__blurb">{t.blurb}</span>
      <ScheduleStrip
        values={t.schedule}
        label={`${t.label}: typical weekday occupancy, midnight to midnight`}
      />
      <span className="ib-typecard__strip-cap" aria-hidden="true">
        Typical weekday
      </span>
    </button>
  );
}

export function TypeCards({
  value,
  onChange,
  types = Object.keys(TYPE_INFO) as BuildingTypeId[],
}: {
  value: BuildingTypeId | undefined;
  onChange: (t: BuildingTypeId) => void;
  types?: BuildingTypeId[];
}) {
  return (
    <fieldset className="ib-typecards">
      <legend className="ib-sr">Building type</legend>
      {types.map((t) => (
        <TypeCard key={t} type={t} selected={value === t} onSelect={onChange} />
      ))}
    </fieldset>
  );
}
