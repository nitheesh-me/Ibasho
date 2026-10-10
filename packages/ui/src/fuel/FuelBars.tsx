/**
 * FuelBars (Hakari 秤, the balance): signed per-fuel diverging bars (DESIGN_SYSTEM 2.2, 2.3, 8;
 * UX 6.3). Owner: WP-06.
 *
 * Centred on zero, never one net bar. A fall in use goes left as a solid `--delta-saving` bar;
 * a rise goes right with the 45 degree `--delta-increase` hatch. Each row carries its fuel crest
 * and a key stroke in the fuel colour, the signed `Num`, and the chart has a table alternative.
 * Bar lengths are read from the same nodes the chips render; there are no axis numbers.
 *
 * DOM: `figure.ib-chart.ib-fuelbars`, rows `[data-fuel][data-direction]`.
 */
import type { EvidenceId, Fuel } from '@ibasho/core';
import type { CSSProperties, ReactNode } from 'react';
import { ChartFrame } from '../chart/TableAlt.tsx';
import { useEvidenceSource } from '../evidence/context.tsx';
import { Mon } from '../mon/Mon.tsx';
import type { MonId } from '../mon/set.ts';
import { magnitude, unit } from '../num/magnitude.ts';
import { Num, type NumProps } from '../num/Num.tsx';

export type FuelRow = Fuel | 'export';

export const FUEL_NAME: Record<FuelRow, string> = {
  electricity: 'Electricity',
  gas: 'Gas',
  oil: 'Oil',
  lpg: 'LPG',
  biomass: 'Biomass',
  district: 'Heat network',
  export: 'Solar export',
};

export const FUEL_TOKEN: Record<FuelRow, string> = {
  electricity: '--fuel-elec',
  gas: '--fuel-gas',
  oil: '--fuel-oil',
  lpg: '--fuel-lpg',
  biomass: '--fuel-bio',
  district: '--fuel-district',
  export: '--fuel-export',
};

export const FUEL_MON: Record<FuelRow, MonId> = {
  electricity: 'fuel-electricity',
  gas: 'fuel-gas',
  oil: 'fuel-oil',
  lpg: 'fuel-lpg',
  biomass: 'fuel-biomass',
  district: 'fuel-district',
  export: 'fuel-export',
};

export interface FuelBarsProps {
  /** Signed change per fuel: negative means less of that fuel is bought (for export: less sold). */
  rows: { fuel: FuelRow; ev: EvidenceId }[];
  /** One sentence, e.g. "Gas falls by about 3,100 kWh a year; electricity rises by 1,400." */
  summary: ReactNode;
  title?: ReactNode;
  /** Display unit for every chip (e.g. `kWh`). */
  as?: NumProps['as'];
  className?: string;
}

/** Saving when less is bought, or more is exported. */
export function isSaving(fuel: FuelRow, value: number): boolean {
  return fuel === 'export' ? value > 0 : value < 0;
}

export function FuelBars({ rows, summary, title, as, className }: FuelBarsProps) {
  const src = useEvidenceSource();
  const measured = rows.map((r) => ({ ...r, m: magnitude(src.node(r.ev)) }));
  const scale = Math.max(
    1e-9,
    ...measured.map((r) => (r.m ? Math.max(Math.abs(r.m.lo), Math.abs(r.m.hi)) : 0)),
  );
  const numProps = as ? { as } : {};

  return (
    <ChartFrame
      className={['ib-fuelbars', className].filter(Boolean).join(' ')}
      title={title}
      summary={summary}
      table={{
        caption: 'Change in each fuel, a year',
        rowHeading: 'Fuel',
        columns: ['Change'],
        rows: measured.map((r) => {
          const mid = r.m?.mid ?? 0;
          const delta = mid === 0 ? undefined : isSaving(r.fuel, mid) ? 'saving' : 'increase';
          return {
            key: r.fuel,
            head: FUEL_NAME[r.fuel],
            cells: [
              delta
                ? { ev: r.ev, signed: true, delta, ...numProps }
                : { ev: r.ev, signed: true, ...numProps },
            ],
          };
        }),
      }}
      legend={
        <span className="ib-fuelbars__legend" aria-hidden="true">
          <span className="ib-fuelbars__key" data-direction="saving">
            <span className="ib-fuelbars__swatch" /> Less bought
          </span>
          <span className="ib-fuelbars__key" data-direction="increase">
            <span className="ib-fuelbars__swatch" /> More bought
          </span>
        </span>
      }
    >
      <ul className="ib-fuelbars__rows">
        {measured.map((r) => {
          const mid = r.m?.mid ?? 0;
          const direction = mid === 0 ? 'none' : isSaving(r.fuel, mid) ? 'saving' : 'increase';
          // Distance from the centre line, as a share of the half width.
          const lo = r.m ? unit(Math.min(Math.abs(r.m.lo), Math.abs(r.m.hi)) / scale) : 0;
          const hi = r.m ? unit(Math.max(Math.abs(r.m.lo), Math.abs(r.m.hi)) / scale) : 0;
          const style = {
            '--fuel': `var(${FUEL_TOKEN[r.fuel]})`,
            '--len': hi,
            '--len-lo': r.m?.range ? lo : hi,
            '--len-mid': unit(Math.abs(mid) / scale),
          } as CSSProperties;
          return (
            <li
              key={r.fuel}
              className="ib-fuelbars__row"
              data-fuel={r.fuel}
              data-direction={direction}
              data-range={r.m?.range ? '' : undefined}
              style={style}
            >
              <span className="ib-fuelbars__name">
                <Mon id={FUEL_MON[r.fuel]} size={16} />
                {FUEL_NAME[r.fuel]}
              </span>
              <span className="ib-fuelbars__beam" aria-hidden="true">
                <span className="ib-fuelbars__half" data-side="saving">
                  {direction === 'saving' ? <span className="ib-fuelbars__bar" /> : null}
                </span>
                <span className="ib-fuelbars__zero" />
                <span className="ib-fuelbars__half" data-side="increase">
                  {direction === 'increase' ? <span className="ib-fuelbars__bar" /> : null}
                </span>
              </span>
              <span className="ib-fuelbars__value">
                <Num
                  ev={r.ev}
                  size="ui"
                  signed
                  {...numProps}
                  {...(direction !== 'none' ? { delta: direction } : {})}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}
