/**
 * Choose mode: current plus what-if (SPEC 18.4, 25). Owner: WP-08.
 *
 * The building as it is beside up to three variants. Every lever recomputes the whole variant
 * (never a summed percentage); the variant lists exactly the levers it changes (AC-W5). The search
 * draws its candidates as ink dots with the front as a brushstroke, and offers three picks, each a
 * one-tap what-if.
 */
import { CompareGrid, Num, PreviewStamp, Range, Stale, TierCaption } from '@ibasho/ui';
import type { ReactNode } from 'react';
import { BASE_LEVERS, LEVERS } from '../preview/settings.ts';
import type { Cand } from '../preview/views.ts';
import { BASE_VARIANT, type BuildingEntry, jobKey, useStudio } from '../state/studio.ts';
import { changeList } from './ProveTell.tsx';
import { Card, Waiting } from './Summary.tsx';

export function ChoosePanel({ b }: { b: BuildingEntry }) {
  const jobs = useStudio((s) => s.jobs);
  const st = useStudio.getState();
  const focus = b.variants.find((v) => v.id === b.focus) ?? b.variants[0];
  const base = jobs[jobKey(b.id, BASE_VARIANT)];
  const opt = base?.views.optimise;
  return (
    <div className="st-stack">
      <Card title="What if" kicker="Scenarios">
        <ol className="st-variants">
          {b.variants.map((v) => (
            <li key={v.id} data-focus={v.id === b.focus ? '' : undefined}>
              <button
                type="button"
                className="st-variants__pick"
                aria-pressed={v.id === b.focus}
                onClick={() => st.setFocus(b.id, v.id)}
              >
                <span className="st-variants__name">{v.name}</span>
                <span className="st-variants__diff">
                  {Object.keys(v.changes).length === 0
                    ? 'The building as it is'
                    : `Adds ${changeList(v.changes)}`}
                </span>
              </button>
              {v.id !== BASE_VARIANT ? (
                <button
                  type="button"
                  className="ib-link"
                  onClick={() => st.removeVariant(b.id, v.id)}
                  aria-label={`Remove ${v.name}`}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {b.variants.length < 4 ? (
          <button type="button" className="ib-btn" onClick={() => st.addVariant(b.id)}>
            Add a what-if
          </button>
        ) : null}
      </Card>
      {focus && focus.id !== BASE_VARIANT ? (
        <Card
          title={`Changes in ${focus.name}`}
          aside={<span className="st-note">Each change recalculates the whole what-if</span>}
        >
          <div className="st-levers">
            {LEVERS.map((l) => {
              const asBuiltWwr = Math.round((base?.views.geometry?.wwrPm ?? 300) / 50) * 5;
              const value = focus.changes[l.id] ?? BASE_LEVERS[l.id] ?? (l.id === 'wwr' ? asBuiltWwr : '');
              const changed = l.id in focus.changes;
              return (
                <div key={l.id} className="st-lever" data-changed={changed ? '' : undefined}>
                  <span className="st-lever__label">{l.label}</span>
                  {l.kind === 'choice' ? (
                    <fieldset className="ib-chips" aria-label={l.label}>
                      {l.choices?.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          className="ib-chip"
                          aria-pressed={value === c.value}
                          onClick={() => st.setLever(b.id, focus.id, l.id, c.value)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </fieldset>
                  ) : (
                    <Range
                      label={l.label}
                      hideLabel
                      value={Number(value)}
                      step={l.step ?? 1}
                      min={l.min ?? 0}
                      max={l.max ?? 100}
                      format={(v) => `${v}${l.unit === '%' ? '%' : ` ${l.unit ?? ''}`}`}
                      {...(l.id === 'wwr' ? { mark: { at: 40, label: 'ECBC 40% limit' } } : {})}
                      onChange={(n) => st.setLever(b.id, focus.id, l.id, n)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <p className="st-note">Pick a what-if to change it. To change the building as it is, use Make.</p>
      )}
      <Card title="Cheapest ways to the goal" kicker="Search" aside={opt ? <PreviewStamp compact /> : null}>
        {opt ? (
          <Stale stale={Boolean(base?.stale.optimise)}>
            <p className="st-goal">Goal: {opt.goalLabel}</p>
            <p className="st-note">
              Tried <Num ev={opt.tried} size="ui" plain /> bundles;{' '}
              <Num ev={opt.frontCount} size="ui" plain /> sit on the front.{' '}
              <TierCaption tier={base?.tiers.optimise} />
            </p>
            <FrontPlot candidates={opt.candidates} picks={opt.picks.map((p) => p.cand.id)} />
            <ul className="st-picks">
              {opt.picks.map((p) => (
                <li key={p.role} className="st-pick">
                  <span className="st-pick__role">{p.label}</span>
                  <span className="st-pick__what">{p.cand.label}</span>
                  <dl className="st-pick__nums">
                    <div>
                      <dt>Upfront</dt>
                      <dd>
                        <Num ev={p.capex} size="ui" />
                      </dd>
                    </div>
                    <div>
                      <dt>Running</dt>
                      <dd>
                        <Num ev={p.opex} size="ui" />
                      </dd>
                    </div>
                    <div>
                      <dt>EUI</dt>
                      <dd>
                        <Num ev={p.eui} size="ui" />
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="ib-btn ib-btn--quiet"
                    onClick={() => {
                      const changes = Object.fromEntries(
                        Object.entries(p.cand.levers).filter(([k, v]) => BASE_LEVERS[k] !== v),
                      );
                      st.applyVariant(b.id, changes, p.label);
                    }}
                    disabled={b.variants.length >= 4}
                  >
                    Try as a what-if
                  </button>
                </li>
              ))}
            </ul>
            <p className="st-note">
              These are Preview estimates. Once calculated for this building, the result is sealed "Nothing
              better among the options we tried", with the list of options.
            </p>
          </Stale>
        ) : (
          <Waiting what="The search" />
        )}
      </Card>
    </div>
  );
}

/** Candidates as ink dots, upfront cost against EUI; the front as one brushstroke (UV 8). */
export function FrontPlot({ candidates, picks }: { candidates: Cand[]; picks: string[] }) {
  if (!candidates.length) return null;
  const xs = candidates.map((c) => c.capexRs);
  const ys = candidates.map((c) => c.eui);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs) || 1;
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const X = (v: number) => 24 + (276 * (v - x0)) / Math.max(1, x1 - x0);
  const Y = (v: number) => 12 + (150 * (v - y0)) / Math.max(1e-6, y1 - y0);
  const front = candidates.filter((c) => c.front).sort((a, b) => a.capexRs - b.capexRs);
  const path = front
    .map((c, i) => `${i ? 'L' : 'M'}${X(c.capexRs).toFixed(1)} ${Y(c.eui).toFixed(1)}`)
    .join('');
  return (
    <figure className="st-front">
      <svg
        viewBox="0 0 310 180"
        role="img"
        aria-label="Every bundle tried: upfront cost to the right, energy use downwards. The front is the brushstroke; the three picks are ringed."
      >
        <line x1="24" y1="166" x2="304" y2="166" className="st-front__axis" />
        <line x1="24" y1="8" x2="24" y2="166" className="st-front__axis" />
        {candidates.map((c) => (
          <circle
            key={c.id}
            cx={X(c.capexRs)}
            cy={Y(c.eui)}
            r={c.front ? 2.4 : 1.6}
            className="st-front__dot"
            data-feasible={c.feasible ? '' : undefined}
          />
        ))}
        <path d={path} className="st-front__brush" />
        {candidates
          .filter((c) => picks.includes(c.id))
          .map((c) => (
            <circle key={`p${c.id}`} cx={X(c.capexRs)} cy={Y(c.eui)} r={6} className="st-front__pick" />
          ))}
        <text x="300" y="178" textAnchor="end" className="st-front__label">
          more upfront
        </text>
        <text x="28" y="16" className="st-front__label">
          less energy
        </text>
      </svg>
      <figcaption className="st-note">
        Hollow dots miss the goal. Lower and further left is better.
      </figcaption>
    </figure>
  );
}

/** The Niwa in Choose mode: variants side by side (1, 2 or 1 + 3). */
export function CompareView({ b, render }: { b: BuildingEntry; render: (variantId: string) => ReactNode }) {
  const jobs = useStudio((s) => s.jobs);
  const st = useStudio.getState();
  const ordered = [
    b.variants.find((v) => v.id === b.focus),
    ...b.variants.filter((v) => v.id !== b.focus),
  ].filter((v): v is NonNullable<typeof v> => Boolean(v));
  const resolutions = new Set(b.variants.map((v) => jobs[jobKey(b.id, v.id)]?.resolution));
  return (
    <div className="st-compare">
      {resolutions.size > 1 ? (
        <p className="st-refuse">
          These results were run at different resolutions, so they are not compared side by side until both
          refresh.
        </p>
      ) : null}
      <CompareGrid
        focus={b.focus}
        onFocus={(id) => st.setFocus(b.id, id)}
        slots={ordered.map((v) => {
          const j = jobs[jobKey(b.id, v.id)];
          const e = j?.views.energy;
          const c = j?.views.codes;
          return {
            id: v.id,
            label: v.name,
            kicker: v.id === BASE_VARIANT ? 'Current' : 'What if',
            body: (
              <div className="st-slot">
                <div className="st-slot__scene">{render(v.id)}</div>
                <Stale stale={Boolean(j?.stale.energy || j?.stale.codes)}>
                  <dl className="st-slot__nums">
                    <div>
                      <dt>EUI</dt>
                      <dd>{e ? <Num ev={e.eui} size="ui" /> : <span className="st-dash">computing</span>}</dd>
                    </div>
                    <div>
                      <dt>Bill</dt>
                      <dd>
                        {e ? <Num ev={e.bill} size="ui" /> : <span className="st-dash">computing</span>}
                      </dd>
                    </div>
                    <div>
                      <dt>Below baseline</dt>
                      <dd>
                        {c ? <Num ev={c.savings} size="ui" /> : <span className="st-dash">computing</span>}
                      </dd>
                    </div>
                  </dl>
                </Stale>
              </div>
            ),
          };
        })}
      />
    </div>
  );
}
