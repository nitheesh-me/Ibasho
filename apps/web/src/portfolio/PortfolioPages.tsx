/**
 * Homes: a portfolio ranked by improvement potential, and one home's Green Home Score with its
 * retrofits, savings, carbon and value (Lloyds brief). Owner: WP-08.
 *
 * Scope is what the brief requires: score and classification with each component's weight,
 * sub-score and contribution; Poor and Very poor flagged with key issues; ranking by improvement
 * potential with electricity and gas reported separately and "unavailable" when it is; the
 * prioritised feasible retrofits (suitability, saving per fuel, reason); the package after
 * interactions; carbon from per-fuel factors; the value change as an indicative range; and a
 * what-if that reruns the calculations, with the narrator only reading the computed results.
 */
import type { EvidenceNode } from '@ibasho/core';
import { ChoiceChips, EvidenceProvider, Num, staticEvidence } from '@ibasho/ui';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { type HomeEv, homeEvidence } from './evidence.ts';
import { type Analysis, analyseHome, type Band, FACTORS, portfolio, type RetrofitId } from './model.ts';

const TYPE_WORDS: Record<string, string> = {
  terraced: 'Terraced house',
  'semi-detached': 'Semi-detached house',
  detached: 'Detached house',
  flat: 'Flat',
  bungalow: 'Bungalow',
};

function BandChip({ band }: { band: Band }) {
  return (
    <span className="pf-band" data-band={band.toLowerCase().replace(' ', '-')}>
      {band}
    </span>
  );
}

function EstimateNote() {
  return <p className="pf-note">All figures are estimates from a documented model, not guarantees.</p>;
}

export function PortfolioPage() {
  const [filter, setFilter] = useState<'all' | 'poor'>('all');
  const { rows, src } = useMemo(() => {
    const nodes: EvidenceNode[] = [];
    const rows = portfolio()
      .map((h) => {
        const a = analyseHome(h);
        return { a, ev: homeEvidence(a, nodes) };
      })
      // Rank by improvement potential; homes where it is unavailable go last.
      .sort((x, y) => (y.a.package?.potentialPct ?? -1) - (x.a.package?.potentialPct ?? -1));
    return { rows, src: staticEvidence(nodes, undefined, 'en-GB') };
  }, []);
  const shown = filter === 'poor' ? rows.filter((r) => r.a.poor) : rows;
  const poorCount = rows.filter((r) => r.a.poor).length;
  return (
    <EvidenceProvider source={src}>
      <div className="pf-page">
        <header className="pf-head">
          <p className="st-kicker">Homes</p>
          <h1 className="pf-title">Which homes to improve first</h1>
          <p className="pf-lede">
            Ranked by improvement potential: how much of the energy each home buys (grid electricity plus gas)
            the feasible retrofits could save.{' '}
            {poorCount === 1 ? 'One home is' : `${words(poorCount)} homes are`} rated Poor or Very poor.
          </p>
          <ChoiceChips
            id="pf-filter"
            label="Show"
            value={filter}
            onChange={setFilter}
            choices={[
              { value: 'all', label: 'All homes' },
              { value: 'poor', label: 'Poor and very poor' },
            ]}
          />
          <EstimateNote />
        </header>
        <ol className="pf-list">
          {shown.map(({ a, ev }, i) => (
            <li key={a.home.id} className="pf-row" data-poor={a.poor ? '' : undefined}>
              <span className="pf-rank" aria-hidden="true">
                <code>{i + 1}</code>
              </span>
              <div className="pf-row__who">
                <Link to={`/portfolio/${a.home.id}`} className="pf-row__id">
                  {a.home.id}
                </Link>
                <span className="pf-row__what">
                  {TYPE_WORDS[a.home.type]}, {a.home.region}
                </span>
              </div>
              <div className="pf-row__score">
                <Num ev={ev.score} size="ui" />
                <BandChip band={a.score.band} />
              </div>
              <div className="pf-row__potential">
                <span className="pf-label">Improvement potential</span>
                {ev.potential ? (
                  <Num ev={ev.potential} size="ui" />
                ) : (
                  <span className="pf-unavailable">Unavailable: no meter readings</span>
                )}
              </div>
              <dl className="pf-row__fuels">
                <div>
                  <dt>Electricity</dt>
                  <dd>
                    {ev.pkgElec ? (
                      <Num ev={ev.pkgElec} size="ui" />
                    ) : (
                      <span className="pf-unavailable">unavailable</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Gas</dt>
                  <dd>
                    {ev.pkgGas ? (
                      <Num ev={ev.pkgGas} size="ui" />
                    ) : (
                      <span className="pf-unavailable">unavailable</span>
                    )}
                  </dd>
                </div>
              </dl>
              {a.poor && a.issues.length ? (
                <ul className="pf-issues" aria-label="Key issues">
                  {a.issues.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="pf-note">
          Savings are a year's change in purchased energy; a negative figure means that fuel's use rises (a
          heat pump raises electricity as gas falls). Solar panels cut grid imports, not the home's energy
          need.
        </p>
      </div>
    </EvidenceProvider>
  );
}

const words = (n: number) =>
  ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'][
    n
  ] ?? 'Many';

export function HomeScorePage() {
  const { id = '' } = useParams();
  const home = portfolio().find((h) => h.id === id);
  const [picked, setPicked] = useState<RetrofitId['id'][] | null>(null);
  const { a, ev, src } = useMemo(() => {
    if (!home) return { a: undefined, ev: undefined, src: staticEvidence([]) };
    // The what-if: rerun every calculation for the chosen package (never adjust the old numbers).
    const a = analyseHome(home, picked ?? undefined);
    const nodes: EvidenceNode[] = [];
    const ev = homeEvidence(a, nodes);
    return { a, ev, src: staticEvidence(nodes, undefined, 'en-GB') };
  }, [home, picked]);
  if (!home || !a || !ev) {
    return (
      <div className="st-empty">
        <p>That home is not in this portfolio.</p>
        <Link to="/portfolio" className="ib-btn">
          Back to homes
        </Link>
      </div>
    );
  }
  const chosen = new Set(a.chosen.map((r) => r.id));
  const toggle = (rid: RetrofitId['id']) => {
    const next = a.feasible
      .filter((r) => (r.id === rid ? !chosen.has(r.id) : chosen.has(r.id)))
      .map((r) => r.id);
    setPicked(next);
  };
  return (
    <EvidenceProvider source={src}>
      <div className="pf-page pf-home">
        <header className="pf-head">
          <p className="st-kicker">
            <Link to="/portfolio">Homes</Link> / {home.id}
          </p>
          <h1 className="pf-title">
            {TYPE_WORDS[home.type]} in {/^(North|South|East|West)/.test(home.region) ? `the ${home.region}` : home.region}
          </h1>
          <p className="pf-lede">
            Built {home.built}, {home.bedrooms} bedrooms, rating {home.rating ?? 'not recorded'}.
          </p>
        </header>

        <section className="pf-card pf-score" aria-labelledby="pf-score">
          <h2 id="pf-score" className="pf-h2">
            Green Home Score
          </h2>
          <p className="pf-score__value">
            <Num ev={ev.score} size="display" /> <span className="pf-score__of">out of 100</span>{' '}
            <BandChip band={a.score.band} />
          </p>
          {a.poor && a.issues.length ? (
            <div className="pf-flag" role="note">
              <strong>Flagged as {a.score.band.toLowerCase()}.</strong> Key issues:
              <ul className="pf-issues">
                {a.issues.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <WhyScore a={a} ev={ev} />
        </section>

        <section className="pf-card" aria-labelledby="pf-retro">
          <h2 id="pf-retro" className="pf-h2">
            What to improve, in order
          </h2>
          <p className="pf-note">
            Only retrofits that suit this home. Each saving is what it adds after the ones above it, so they
            add up to the package. Untick one to see the package without it; every figure is worked out again.
          </p>
          {a.feasible.length === 0 ? <p className="pf-note">Nothing more fits this home today.</p> : null}
          <ol className="pf-retros">
            {a.feasible.map((r) => (
              <li key={r.id} className="pf-retro" data-chosen={chosen.has(r.id) ? '' : undefined}>
                <button
                  type="button"
                  className="pf-retro__pick"
                  aria-pressed={chosen.has(r.id)}
                  onClick={() => toggle(r.id)}
                >
                  <span className="pf-retro__box" aria-hidden="true" />
                  <span className="pf-retro__name">{r.label}</span>
                </button>
                <span className="pf-suit" data-suit={r.suitability.toLowerCase()}>
                  {r.suitability} suitability
                </span>
                <p className="pf-retro__why">
                  {r.reason}
                  {chosen.has(r.id) ? '' : ' Not in the plan: the savings show what it would add.'}
                </p>
                <dl className="pf-retro__fuels">
                  <div>
                    <dt>Electricity saved</dt>
                    <dd>
                      {ev.elec[r.id] ? (
                        <Num ev={ev.elec[r.id] as `ev_${string}`} size="ui" />
                      ) : (
                        <span className="pf-unavailable">unavailable</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Gas saved</dt>
                    <dd>
                      {ev.gas[r.id] ? (
                        <Num ev={ev.gas[r.id] as `ev_${string}`} size="ui" />
                      ) : (
                        <span className="pf-unavailable">unavailable</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>

        <section className="pf-card pf-results" aria-labelledby="pf-pkg">
          <h2 id="pf-pkg" className="pf-h2">
            The package
          </h2>
          {a.package && ev.pkgElec && ev.pkgGas && ev.pkgTotal ? (
            <dl className="pf-figs">
              <div>
                <dt>Electricity saved a year</dt>
                <dd>
                  <Num ev={ev.pkgElec} />
                </dd>
              </div>
              <div>
                <dt>Gas saved a year</dt>
                <dd>
                  <Num ev={ev.pkgGas} />
                </dd>
              </div>
              <div>
                <dt>Net energy saved a year</dt>
                <dd>
                  <Num ev={ev.pkgTotal} />
                </dd>
              </div>
              <div>
                <dt>Improvement potential</dt>
                <dd>
                  {ev.potential ? (
                    <Num ev={ev.potential} />
                  ) : (
                    <span className="pf-unavailable">unavailable</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Carbon cut a year</dt>
                <dd>{ev.carbon ? <Num ev={ev.carbon} as="tCO2e" /> : null}</dd>
              </div>
              <div>
                <dt>Score after</dt>
                <dd>{ev.scoreAfter ? <Num ev={ev.scoreAfter} /> : null}</dd>
              </div>
            </dl>
          ) : (
            <p className="pf-unavailable">
              Unavailable: this home has no meter readings yet, so its savings and improvement potential
              cannot be worked out. The score uses a midpoint for energy use until readings arrive.
            </p>
          )}
          <p className="pf-note">
            Carbon uses {FACTORS.source}: electricity <code>{FACTORS.elec}</code>, gas{' '}
            <code>{FACTORS.gas}</code>.
          </p>
          {a.value && ev.value && ev.uplift ? (
            <div className="pf-value">
              <h3 className="pf-h3">Property value, indicative</h3>
              <p>
                From about <Num ev={ev.valueNow} size="ui" /> to <Num ev={ev.value} size="ui" /> (
                <Num ev={ev.uplift} size="ui" />
                ), if the rating rises from {home.rating ?? 'E'} to {a.ratingAfter}.
              </p>
              <p className="pf-note">
                An estimated potential impact based on relationships between ratings and sale prices in the
                prepared data, holding the rest of the home the same. It is indicative, not a proven or
                guaranteed increase.
              </p>
            </div>
          ) : null}
          <Narrator a={a} ev={ev} />
          <EstimateNote />
        </section>
      </div>
    </EvidenceProvider>
  );
}

function WhyScore({ a, ev }: { a: Analysis; ev: HomeEv }) {
  return (
    <figure className="pf-why">
      <figcaption className="pf-h3">Why this score</figcaption>
      <table className="pf-why__table">
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">Weight</th>
            <th scope="col">Sub-score</th>
            <th scope="col">Adds to the score</th>
          </tr>
        </thead>
        <tbody>
          {a.score.components.map((c) => (
            <tr key={c.id}>
              <th scope="row">
                <span className="pf-why__part">{c.label}</span>
                <span className="pf-why__basis">{c.basis}</span>
              </th>
              <td>
                <Num ev={ev.weight[c.id] as `ev_${string}`} size="ui" plain />
              </td>
              <td>
                <span className="pf-why__bar" aria-hidden="true">
                  <span style={{ inlineSize: `${c.sub}%` }} />
                </span>
                <Num ev={ev.sub[c.id] as `ev_${string}`} size="ui" plain />
              </td>
              <td>
                <Num ev={ev.contribution[c.id] as `ev_${string}`} size="ui" plain />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pf-note">
        Score = the sum of weight times sub-score, rounded. A better state never lowers a sub-score.
      </p>
    </figure>
  );
}

/** The narrator reads computed values only; it never works a figure out itself. */
function Narrator({ a, ev }: { a: Analysis; ev: HomeEv }) {
  if (!a.package || !ev.pkgTotal) return null;
  const hp = a.chosen.find((r) => r.id === 'heat-pump');
  return (
    <div className="pf-narrator" aria-live="polite">
      <p className="pf-narrator__label">In plain words</p>
      <p>
        This home scores <Num ev={ev.score} size="ui" plain /> ({a.score.band.toLowerCase()}).
        {a.chosen.length ? (
          <>
            {' '}
            With {a.chosen.map((r) => r.label.toLowerCase()).join(', ')}, it would buy about{' '}
            <Num ev={ev.pkgTotal} size="ui" plain /> less energy a year
            {ev.carbon ? (
              <>
                {' '}
                and cut <Num ev={ev.carbon} size="ui" as="tCO2e" plain /> of carbon
              </>
            ) : null}
            .
            {hp
              ? ' The heat pump moves heating from gas to electricity, so electricity use goes up while gas use falls.'
              : ''}
          </>
        ) : (
          ' No retrofits are chosen, so nothing changes.'
        )}
      </p>
    </div>
  );
}
