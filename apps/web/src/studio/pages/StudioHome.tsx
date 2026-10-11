/**
 * Studio home: your places, Welcome back, and Restart (SPEC 17, 18.2, 18.3). Owner: WP-08.
 *
 * Revisit reads the session in one query and shows the days away, what changed (tariff, code
 * edition, weather file, data pack), each as a before and after with its source, the headline
 * numbers recomputed both ways (never a silent change), plan progress and one next action.
 * Restart offers Start over (a new empty place; the old one stays) and Branch (a copy with a
 * lineage link). Nothing is deleted unless the person asks.
 */
import type { Place } from '@ibasho/core';
import { EvidenceProvider, Mon, Num, PreviewStamp, staticEvidence, TYPE_INFO } from '@ibasho/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { agoWords } from '../hooks.ts';
import { DocThumb } from '../panels/Make.tsx';
import { headline } from '../preview/runner.ts';
import { BASE_LEVERS } from '../preview/settings.ts';
import { BASE_VARIANT, jobKey, useStudio } from '../state/studio.ts';

export function StudioHome() {
  const ready = useStudio((s) => s.ready);
  const places = useStudio((s) => s.places);
  const buildings = useStudio((s) => s.buildings);
  const settings = useStudio((s) => s.settings);
  const revisit = useStudio((s) => s.revisit);
  const revisitB = revisit ? places[revisit.placeId]?.place.buildingIds[0] : undefined;
  const revOut = useStudio((s) => (revisitB ? s.jobs[jobKey(revisitB, BASE_VARIANT)]?.outputs : undefined));
  const nav = useNavigate();
  const st = useStudio.getState();
  const list = Object.values(places).sort((a, b) => b.updatedAt - a.updatedAt);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const last = Object.values(useStudio.getState().places).sort(
      (a, b) => (b.visitedAt ?? 0) - (a.visitedAt ?? 0),
    )[0];
    if (last && !useStudio.getState().revisit) useStudio.getState().visit(last.place.id);
  }, [ready]);

  // Headline numbers both ways for the diff card (AC-RV1).
  const diff = useMemo(() => {
    if (!revisit) return undefined;
    const p = places[revisit.placeId];
    const b = p ? buildings[p.place.buildingIds[0] ?? ''] : undefined;
    if (!b) return undefined;
    const base = {
      placeId: b.placeId,
      variantId: 'as-built',
      doc: b.doc,
      levers: BASE_LEVERS,
      resolution: 'standard' as const,
      asOf: new Date().toISOString(),
      place: places[b.placeId]?.place as Place,
      tiles: [],
      previous: revOut ?? {},
    };
    const before = headline({ ...base, key: 'rv-before', settings: revisit.before });
    const after = headline({ ...base, key: 'rv-after', settings });
    return {
      b,
      before: before.view,
      after: after.view,
      src: staticEvidence([...before.nodes, ...after.nodes], undefined, 'en-IN'),
    };
  }, [revisit, places, buildings, settings, revOut]);

  if (!ready) return <p className="st-loading">Opening your places.</p>;

  return (
    <div className="st-home">
      <header className="st-home__head">
        <p className="st-kicker">Studio</p>
        <h1 className="st-home__title">Your places</h1>
        <p className="st-home__lede">
          Place a building in its real city, draw it floor by floor, and see its sun, daylight, energy, code
          standing and best upgrades.
        </p>
        <div className="st-home__actions">
          <Link to="/new" className="ib-btn ib-btn--hero">
            Start a new place
          </Link>
          <Link to="/design" className="ib-btn ib-btn--quiet">
            Design before you build
          </Link>
          <button
            type="button"
            className="ib-btn ib-btn--quiet"
            onClick={() => {
              const id = st.startOver();
              nav(`/new?place=${id}`);
            }}
            title="A new, empty place. Everything you have stays here."
          >
            Start over
          </button>
        </div>
      </header>

      {revisit && !revisit.dismissed && diff ? (
        <section className="st-welcome" aria-label="Welcome back">
          <div className="st-welcome__head">
            <h2>Welcome back</h2>
            <span className="st-welcome__away">
              Last here {agoWords(Date.now() - revisit.daysAway * 86_400_000)}
            </span>
            <PreviewStamp compact />
          </div>
          <ul className="st-changes">
            {revisit.changes.map((c) => (
              <li key={c.what} data-kind={c.kind}>
                <span className="st-changes__what">{c.what}</span>
                <span className="st-changes__ba">
                  <s>{c.before}</s> <span aria-hidden="true">→</span> <strong>{c.after}</strong>
                </span>
                <span className="st-changes__src">{c.source}</span>
              </li>
            ))}
          </ul>
          <EvidenceProvider source={diff.src}>
            <div className="st-diff">
              <h3>What it does to {diff.b.name}</h3>
              <dl>
                <div>
                  <dt>Electricity bill</dt>
                  <dd>
                    <Num ev={diff.before.bill} size="ui" /> <span aria-hidden="true">→</span>{' '}
                    <Num ev={diff.after.bill} size="ui" />
                  </dd>
                </div>
                {Math.abs(diff.before.euiMid - diff.after.euiMid) > 0.5 ? (
                  <div>
                    <dt>Energy use intensity</dt>
                    <dd>
                      <Num ev={diff.before.eui} size="ui" /> <span aria-hidden="true">→</span>{' '}
                      <Num ev={diff.after.eui} size="ui" />
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="st-note">
                Old results keep their record; these are recomputed with the new tariff, shown side by side.
              </p>
            </div>
          </EvidenceProvider>
          <div className="st-welcome__next">
            <span>
              {diff.b.variants.length - 1
                ? `You were weighing ${diff.b.variants.length - 1 === 1 ? 'one change' : 'some changes'} against the building as it is.`
                : 'You have not tried any changes yet.'}
            </span>
            <Link to={`/p/${revisit.placeId}/b/${diff.b.id}?level=building&mode=choose`} className="ib-btn">
              See what the new tariff changes
            </Link>
            <button type="button" className="ib-link" onClick={() => st.dismissRevisit()}>
              Not now
            </button>
          </div>
        </section>
      ) : null}

      <section aria-label="Places" className="st-places">
        {list.map((p) => {
          const first = buildings[p.place.buildingIds[0] ?? ''];
          return (
            <article key={p.place.id} className="st-place" data-sample={p.place.sample ? '' : undefined}>
              <Link
                to={first ? `/p/${p.place.id}/b/${first.id}?level=building` : `/new?place=${p.place.id}`}
                className="st-place__open"
              >
                <span className="st-place__thumb" aria-hidden="true">
                  {first ? (
                    <DocThumb doc={first.doc} />
                  ) : (
                    <span className="st-place__empty">An empty plot, a pencil</span>
                  )}
                </span>
                <span className="st-place__name">{p.place.name}</span>
                <span className="st-place__area">{p.area}</span>
              </Link>
              <ul className="st-place__buildings">
                {p.place.buildingIds.map((id) => {
                  const b = buildings[id];
                  if (!b) return null;
                  return (
                    <li key={id}>
                      <Mon id={TYPE_INFO[b.typeId].mon} size={16} />
                      <Link to={`/p/${p.place.id}/b/${id}?level=building`}>{b.name}</Link>
                      {b.lineage ? <span className="st-lineage">branched</span> : null}
                    </li>
                  );
                })}
              </ul>
              <div className="st-place__meta">
                {p.place.sample ? <span className="st-tag">Sample</span> : null}
                {p.lineage ? (
                  <span className="st-tag">
                    Branched from {places[p.lineage.from]?.place.name ?? 'an earlier place'}
                  </span>
                ) : null}
                <span className="st-place__when">Changed {agoWords(p.updatedAt)}</span>
              </div>
              <div className="st-place__actions">
                <button
                  type="button"
                  className="ib-link"
                  onClick={() => {
                    const id = st.branch(p.place.id);
                    nav(`/p/${id}`);
                  }}
                  title="Copy this place into a new project; the original stays as it is"
                >
                  Branch
                </button>
                <Link to={`/new?place=${p.place.id}`} className="ib-link">
                  Add a building
                </Link>
                {confirm === p.place.id ? (
                  <span className="st-confirm">
                    Delete for good?{' '}
                    <button type="button" className="ib-link" onClick={() => st.removePlace(p.place.id)}>
                      Delete
                    </button>{' '}
                    <button type="button" className="ib-link" onClick={() => setConfirm(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ib-link st-place__del"
                    onClick={() => setConfirm(p.place.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          );
        })}
        <article className="st-place st-place--sample">
          <Link to="/home/gh1" className="st-place__open">
            <span className="st-place__thumb" aria-hidden="true">
              <Mon id="type-single-family" size={48} />
            </span>
            <span className="st-place__name">London terrace</span>
            <span className="st-place__area">A 1905 terrace house, ready to explore</span>
          </Link>
          <div className="st-place__meta">
            <span className="st-tag">Sample</span>
          </div>
        </article>
        <article className="st-place st-place--sample">
          <Link to="/new?template=office" className="st-place__open">
            <span className="st-place__thumb" aria-hidden="true">
              <Mon id="type-office" size={48} />
            </span>
            <span className="st-place__name">Office template</span>
            <span className="st-place__area">Start a new office from a massing template</span>
          </Link>
          <div className="st-place__meta">
            <span className="st-tag">Template</span>
          </div>
        </article>
      </section>
    </div>
  );
}
