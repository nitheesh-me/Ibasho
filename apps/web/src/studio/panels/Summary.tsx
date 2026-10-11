/**
 * Building and site summaries for the Zashiki (SPEC 22, UV 3.2 level table). Owner: WP-08.
 *
 * Every number is a `Num` over a Preview evidence node. A stage that is re-running keeps its old
 * value under the stale hatch ("updating"); a stage with no result yet shows a pencil placeholder,
 * never a zero.
 */
import { EndUseBar, EuiGauge, Num, PreviewStamp, Stale, TierCaption } from '@ibasho/ui';
import type { ReactNode } from 'react';
import type { Job } from '../state/studio.ts';

export function Waiting({ what }: { what: string }) {
  return (
    <p className="st-waiting" aria-busy="true">
      <span className="st-waiting__pencil" aria-hidden="true" />
      {what} is on its way.
    </p>
  );
}

export function Card({
  title,
  kicker,
  children,
  aside,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="st-card">
      <header className="st-card__head">
        {kicker ? <span className="st-card__kicker">{kicker}</span> : null}
        <h3 className="st-card__title">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function KeyNumbers({
  items,
}: {
  items: { label: string; ev: `ev_${string}` | undefined; note?: ReactNode }[];
}) {
  return (
    <dl className="st-keys">
      {items.map((k) => (
        <div key={k.label}>
          <dt>{k.label}</dt>
          <dd>{k.ev ? <Num ev={k.ev} /> : <span className="st-dash">not yet</span>}</dd>
          {k.note ? <dd className="st-keys__note">{k.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export function BuildingSummary({ job }: { job: Job | undefined }) {
  const e = job?.views.energy;
  const g = job?.views.geometry;
  const d = job?.views.daylight;
  const c = job?.views.codes;
  return (
    <div className="st-stack">
      <Card title="Energy" kicker="Building" aside={<TierCaption tier={job?.tiers.energy} />}>
        {e ? (
          <Stale stale={Boolean(job?.stale.energy)}>
            <EuiGauge
              eui={e.eui}
              target={{ ev: e.target, label: 'ECSBC 2024 standard design' }}
              bands={e.bands}
              scaleMax={260}
              partial={e.partial}
              missing={e.missing}
              preview
              caption={
                g && g.untyped > 0 ? 'Some rooms have no function yet, so the range is wider.' : undefined
              }
            />
          </Stale>
        ) : (
          <Waiting what="The energy result" />
        )}
      </Card>
      <Card title="Where the energy goes" aside={e ? <PreviewStamp compact /> : null}>
        {e ? (
          <Stale stale={Boolean(job?.stale.energy)}>
            <EndUseBar rows={e.endUses} title="End uses over a year" />
          </Stale>
        ) : (
          <Waiting what="The end-use split" />
        )}
      </Card>
      <Card title="Money, carbon, comfort">
        <Stale stale={Boolean(job?.stale.energy || job?.stale.daylight)}>
          <KeyNumbers
            items={[
              { label: 'Electricity bill', ev: e?.bill },
              { label: 'Operational carbon', ev: e?.carbon },
              {
                label: 'Classroom hours comfortable with fans alone',
                ev: e?.fanHours,
                note: 'Fan-first (IMAC adaptive)',
              },
              { label: 'Daylit floor area', ev: d?.ecbc },
              { label: 'Savings against the code baseline', ev: c?.savings },
              { label: 'Conditioned area', ev: g?.nca },
            ]}
          />
        </Stale>
      </Card>
    </div>
  );
}
