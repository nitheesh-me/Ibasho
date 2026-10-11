/**
 * Prove and Tell (SPEC 23, PLAN-V3 moments 5 and the closing beat). Owner: WP-08.
 *
 * Prove lists every code and rating that applies to the place, type and size, each with its
 * applicability status, edition, clause, grade and result. The word "compliant" never appears; a
 * rule with a missing fact reads unknown and names the fact. Ratings are estimates on one savings
 * axis (three gates, one pass). Tell is one plain paragraph and what Ibasho will remember.
 */
import { ApplicabilityChip, GradeBadge, Num, PreviewStamp, RatingLadder, Stale } from '@ibasho/ui';
import { Link } from 'react-router';
import { BASE_VARIANT, type BuildingEntry, type Job, jobKey, useStudio } from '../state/studio.ts';
import { Card, SavingsWords, Waiting } from './Summary.tsx';

const LEVER_PHRASE: Record<string, (v: string | number) => string> = {
  wwr: (v) => `windows at ${v}% of the wall`,
  shading: (v) =>
    v === 'chajja'
      ? 'chajjas on the sunny facades'
      : v === 'deep'
        ? 'deep overhangs and fins on the sunny facades'
        : v === 'jaali'
          ? 'jaali screens on the sunny facades'
          : 'shading as drawn',
  glazing: (v) => (v === 'low-e' ? 'low-e double glazing' : 'glazing as drawn'),
  roof: (v) => (v === 'cool' ? 'a cool roof' : 'the roof as drawn'),
  wall: (v) => (v === 'insulated' ? 'insulated walls' : 'walls as drawn'),
  setpoint: (v) => `cooling set to ${v} °C`,
  lighting: (v) => (v === 'led' ? 'LED lighting' : 'lighting as drawn'),
  daylight: (v) => (v === 'on' ? 'daylight dimming' : 'no daylight controls'),
  hvac: (v) =>
    v === 'vrf'
      ? 'VRF cooling'
      : v === 'chiller'
        ? 'a chiller with DOAS'
        : v === 'split'
          ? 'split units'
          : 'cooling as drawn',
  pv: (v) => `solar panels on ${v}% of the roof`,
};

/** "Shaded and cool adds chajjas on the sunny facades, a cool roof and low-e double glazing." */
export function changeList(changes: Record<string, string | number>): string {
  const parts = Object.entries(changes).map(([k, v]) => LEVER_PHRASE[k]?.(v) ?? `${k} ${v}`);
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function memorySentence(name: string, changes: Record<string, string | number>): string {
  const list = changeList(changes);
  return list ? `${name} adds ${list}.` : `${name} has no changes yet.`;
}

const STATUS: Record<string, string> = {
  true: 'Passes the pre-check',
  false: 'Misses the pre-check',
  unknown: 'Unknown',
};

export function ProvePanel({ job, b }: { job: Job | undefined; b: BuildingEntry }) {
  const c = job?.views.codes;
  return (
    <div className="st-stack">
      <p className="st-banner">
        Pre-checks, not certificates. Each line says how far it applies here.{' '}
        {b.doc.permitDate
          ? null
          : 'The permit date is not set, so local adoption must be confirmed for every edition.'}
      </p>
      <Card title="Code and green ratings on one scale" kicker="Ratings" aside={c ? <PreviewStamp compact /> : null}>
        {c ? (
          <Stale stale={Boolean(job?.stale.codes)}>
            <RatingLadder savings={c.savings} rows={c.ladder} axisMax={45} />
            <p className="st-note">
              Code baseline <Num ev={c.baseline} size="ui" />, ECSBC 2024 standard design (Preview).
            </p>
          </Stale>
        ) : (
          <Waiting what="The rating ladder" />
        )}
      </Card>
      <Card title="Energy codes" kicker="Pre-check">
        {c ? (
          <Stale stale={Boolean(job?.stale.codes)}>
            <ul className="st-codes">
              {c.rows.map((r) => (
                <li key={r.row.ruleId} className="st-code" data-status={String(r.row.status)}>
                  <span className="st-code__mark" aria-hidden="true" />
                  <div className="st-code__body">
                    <span className="st-code__title">{r.title}</span>
                    <span className="st-code__meta">
                      <code>{r.row.edition}</code>
                      {r.row.clause ? <code> {r.row.clause}</code> : null} <GradeBadge grade={r.row.grade} />
                      <ApplicabilityChip value={r.row.applicability} />
                    </span>
                    <span className="st-code__status">
                      {STATUS[String(r.row.status)]}
                      {r.reading ? (
                        <>
                          {', reads '}
                          <Num ev={r.reading} size="ui" />
                        </>
                      ) : null}
                      {r.row.tier
                        ? `, tier ${r.row.tier === 2 ? 'Plus' : r.row.tier === 3 ? 'Super' : 'base'}`
                        : ''}
                      {r.row.unknownFacts?.length ? `. Missing: ${r.row.unknownFacts.join(', ')}.` : ''}
                      {r.limitText ? ` ${r.limitText}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Stale>
        ) : (
          <Waiting what="The code pre-check" />
        )}
      </Card>
      <Card title="Seals" kicker="Evidence">
        <p className="st-note">
          Every number here is a Preview estimate, so none carries a Checked seal yet. Once a figure is
          calculated for this building, its arithmetic is checked independently and you can open how it was
          worked out. <Link to="/proofs">What we prove</Link>.
        </p>
      </Card>
    </div>
  );
}

export function TellPanel({ b }: { b: BuildingEntry }) {
  const jobs = useStudio((s) => s.jobs);
  const base = jobs[jobKey(b.id, BASE_VARIANT)];
  const e = base?.views.energy;
  const c = base?.views.codes;
  const d = base?.views.daylight;
  const r = base?.views.radiation;
  const best = b.variants.filter((v) => v.id !== BASE_VARIANT);
  const hot = r ? [...r.facades].sort((x, y) => y.kwh - x.kwh)[0] : undefined;
  return (
    <div className="st-stack">
      <Card title={`${b.name}, in plain words`} kicker="Story" aside={<PreviewStamp compact />}>
        {e && c && d ? (
          <div className="st-story">
            <p>
              {b.name} uses about <Num ev={e.eui} plain /> of energy for each square metre it cools, against a
              code standard design of <Num ev={c.baseline} plain />. Cooling is the largest share, and the{' '}
              {hot?.bin ?? 'west'} facades take the most sun.
            </p>
            <p>
              Daylight reaches <Num ev={d.ecbc} plain /> of the floor. Against the code baseline it is{' '}
              <SavingsWords c={c} />; the star and tier ratings read from that one figure.
            </p>
            <p>
              {best.length
                ? `You are weighing ${best.map((v) => v.name).join(' and ')}. Each was recomputed whole, never added up from parts.`
                : 'Add a what-if in Choose to weigh a change against the building as it is.'}
            </p>
          </div>
        ) : (
          <Waiting what="The story" />
        )}
      </Card>
      <Card title="What Ibasho will remember" kicker="Memory">
        <ul className="st-memory">
          <li>This building is an education block with labs and a data centre, in Hyderabad.</li>
          {best.map((v) => (
            <li key={v.id}>{memorySentence(v.name, v.changes)}</li>
          ))}
          <li>Numbers here are Preview estimates and are not saved as results.</li>
        </ul>
        <button type="button" className="ib-btn ib-btn--quiet" onClick={() => window.print()}>
          Print a report
        </button>
      </Card>
    </div>
  );
}
