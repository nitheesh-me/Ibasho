/**
 * Look mode: lenses (SPEC 21, UV 6). Owner: WP-08.
 *
 * One lens at a time, chosen from a chip row; one shared panel (What, When, Where, How fine,
 * Result, Inspect) with a legend that names unit, resolution, period, method, tier, "Modelled"
 * and the Preview stamp.
 */
import type { ResolutionLevel, Place } from '@ibasho/core';
import { AnalysisLegend, Histogram, LensPanel, Num, type RampName, Stale } from '@ibasho/ui';
import type { ReactNode } from 'react';
import type { Job } from '../state/studio.ts';
import { inTropics, weatherCity } from '../data.ts';
import { Waiting } from './Summary.tsx';

export type LensId = 'shadows' | 'sun-hours' | 'radiation' | 'daylight' | 'glare' | 'thermal' | 'neighbours';

export const LENSES: {
  id: LensId;
  label: string;
  ramp: RampName;
  stage: 'sun' | 'radiation' | 'daylight' | 'energy';
}[] = [
  { id: 'shadows', label: 'Shadows', ramp: 'hidamari', stage: 'sun' },
  { id: 'sun-hours', label: 'Sun hours', ramp: 'hidamari', stage: 'sun' },
  { id: 'radiation', label: 'Radiation', ramp: 'hinata', stage: 'radiation' },
  { id: 'daylight', label: 'Daylight', ramp: 'akari', stage: 'daylight' },
  { id: 'glare', label: 'Glare risk', ramp: 'akari', stage: 'daylight' },
  { id: 'thermal', label: 'Comfort', ramp: 'netsu', stage: 'energy' },
  { id: 'neighbours', label: 'Neighbours', ramp: 'kotai', stage: 'sun' },
];

export function LensChips({ lens, onLens }: { lens: LensId; onLens: (l: LensId) => void }) {
  return (
    <fieldset className="st-lenschips" aria-label="Lens">
      {LENSES.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={lens === l.id}
          className="ib-chip"
          onClick={() => onLens(l.id)}
        >
          {l.label}
        </button>
      ))}
    </fieldset>
  );
}

const DETAIL: Record<ResolutionLevel, string> = {
  sketch: 'grid 2 m, 60 min steps, 145 sky patches',
  standard: 'grid 1 m, 15 min steps, 145 sky patches',
  fine: 'grid 0.5 m, 6 min steps, 577 sky patches',
};

export interface LookPanelProps {
  lens: LensId;
  onLens: (l: LensId) => void;
  job: Job | undefined;
  resolution: ResolutionLevel;
  onResolution: (r: ResolutionLevel) => void;
  when: string;
  where: string;
  inspect?: ReactNode;
  typeId?: string;
  /** The plot: its weather year and latitude set the copy. */
  place?: Place | undefined;
}

export function LookPanel(p: LookPanelProps) {
  const j = p.job;
  const sun = j?.views.sun;
  const rad = j?.views.radiation;
  const day = j?.views.daylight;
  const en = j?.views.energy;
  const def = LENSES.find((l) => l.id === p.lens) ?? LENSES[0];
  if (!def) return null;
  const stale = Boolean(j?.stale[def.stage]);
  const tier = j?.tiers[def.stage];
  const legend = (
    unit: string,
    min?: `ev_${string}`,
    max?: `ev_${string}`,
    method = 'Ray cast against the city model',
    refuse?: string,
  ) => (
    <AnalysisLegend
      ramp={def.ramp}
      unit={unit}
      {...(min ? { min } : {})}
      {...(max ? { max } : {})}
      resolution={p.resolution}
      resolutionDetail={DETAIL[p.resolution]}
      period={p.when}
      method={method}
      {...(tier ? { tier } : {})}
      preview
      {...(refuse ? { refuse } : {})}
    />
  );

  let body: ReactNode = <Waiting what={`The ${def.label.toLowerCase()} result`} />;
  if (p.lens === 'shadows' || p.lens === 'sun-hours' || p.lens === 'neighbours') {
    if (sun) {
      const sorted = [...sun.facades].sort((a, b) => a.h - b.h);
      const lo = sorted[0];
      const hi = sorted[sorted.length - 1];
      body = (
        <LensPanel
          title={def.label}
          what={
            p.lens === 'shadows'
              ? 'Where the shadows fall at the time on the strip, from your building and its neighbours.'
              : p.lens === 'neighbours'
                ? 'Sun your building takes from the neighbours, and who takes yours.'
                : 'Hours of direct sun on each facade, averaged over the day.'
          }
          when={p.when}
          where={p.where}
          resolution={p.resolution}
          onResolution={p.onResolution}
          preview
          legend={legend(
            'hours a day',
            lo?.ev,
            sun.roof,
            'Sun position every step, ray cast past the neighbours',
          )}
          keys={
            p.lens === 'neighbours'
              ? [{ label: 'Winter sun taken from Himalaya A', ev: sun.neighbourLoss }]
              : [
                  { label: 'Roof', ev: sun.roof },
                  ...(hi ? [{ label: `Sunniest facade (${hi.bin})`, ev: hi.ev }] : []),
                  ...(lo ? [{ label: `Shadiest facade (${lo.bin})`, ev: lo.ev }] : []),
                ]
          }
          inspect={p.inspect}
        />
      );
    }
  } else if (p.lens === 'radiation') {
    if (rad) {
      const sorted = [...rad.facades].sort((a, b) => a.kwh - b.kwh);
      const hi = sorted[sorted.length - 1];
      const lo = sorted[0];
      body = (
        <LensPanel
          title="Radiation"
          what="Sunlight energy falling on each facade and the roof over a typical year."
          when={`Typical weather year for ${weatherCity(p.place)}`}
          where={p.where}
          resolution={p.resolution}
          onResolution={p.onResolution}
          preview
          legend={legend(
            'kWh/m² a year',
            rad.min,
            rad.max,
            'Sky model over the year, with shade from the neighbours',
          )}
          keys={[
            { label: 'Roof', ev: rad.roof },
            ...(hi ? [{ label: `Most on a facade (${hi.bin})`, ev: hi.ev }] : []),
            ...(lo ? [{ label: `Least (${lo.bin})`, ev: lo.ev }] : []),
          ]}
          inspect={p.inspect}
        >
          {inTropics(p.place) ? (
            <p className="st-note">
              Here the noon sun stands in the north from about May to early August, so north glass needs short fins
              too.
            </p>
          ) : (
            <p className="st-note">The sun stays in the south here; south and west glass take the most.</p>
          )}
        </LensPanel>
      );
    }
  } else if (p.lens === 'daylight' || p.lens === 'glare') {
    if (day) {
      body = (
        <LensPanel
          title={p.lens === 'glare' ? 'Glare risk' : 'Daylight'}
          what={
            p.lens === 'glare'
              ? 'Floor area that gets too much direct sun (over 1,000 lux for 250 hours).'
              : 'Floor area lit well by daylight for most of the year, on a 0.8 m work plane.'
          }
          when="Occupied hours, typical year"
          where={p.where}
          resolution={p.resolution}
          onResolution={p.onResolution}
          preview
          legend={legend('% of floor', undefined, undefined, 'Simplified daylight model')}
          keys={
            p.lens === 'glare'
              ? [{ label: 'ASE, whole building', ev: day.ase }]
              : [
                  { label: 'ECBC daylit share', ev: day.ecbc },
                  { label: 'sDA (simplified)', ev: day.sda },
                  { label: 'Glare risk (ASE)', ev: day.ase },
                ]
          }
          histogram={
            <Histogram
              bins={Object.values(day.rooms).reduce((b, v) => {
                const i = Math.min(9, Math.floor(v * 10));
                b[i] = (b[i] ?? 0) + 1;
                return b;
              }, Array(10).fill(0) as number[])}
              ramp="akari"
              label="Rooms by daylit share"
            />
          }
          inspect={p.inspect}
        >
          <ul className="st-floors">
            {day.storeys.map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <span className="st-floors__bar" aria-hidden="true">
                  <span style={{ inlineSize: `${Math.round(100 * s.share)}%` }} />
                  <i style={{ insetInlineStart: '40%' }} />
                </span>
                <Num ev={s.ev} size="ui" />
              </li>
            ))}
          </ul>
          <p className="st-note">The tick marks the ECBC 40% daylit area target for education.</p>
        </LensPanel>
      );
    }
  } else if (p.lens === 'thermal') {
    if (en) {
      body = (
        <LensPanel
          title="Comfort"
          what={
            p.typeId === 'education'
              ? 'Hours each classroom is comfortable with ceiling fans alone, then with AC at the set point.'
              : 'Hours the occupied rooms are comfortable with ceiling fans alone, then with AC at the set point.'
          }
          when="Occupied hours, typical year"
          where={p.typeId === 'education' ? 'Classrooms, all floors' : 'Occupied rooms, all floors'}
          resolution={p.resolution}
          onResolution={p.onResolution}
          preview
          legend={legend(
            'hours a year',
            undefined,
            undefined,
            'Indian adaptive comfort model (IMAC), fan first',
          )}
          keys={[
            { label: 'Comfortable with fans alone', ev: en.fanHours },
            { label: 'Need AC', ev: en.acHours },
          ]}
          inspect={p.inspect}
        >
          <p className="st-note">
            A 28 to 30 °C set point with a fan can save much of the cooling energy. Try the set point lever in
            Choose.
          </p>
        </LensPanel>
      );
    }
  }
  return (
    <div className="st-stack">
      <LensChips lens={p.lens} onLens={p.onLens} />
      <Stale stale={stale}>{body}</Stale>
    </div>
  );
}
