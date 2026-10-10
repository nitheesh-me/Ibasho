/**
 * `/app/home/:id`, the home stage (SPEC 5.3). Owner: WP-08.
 *
 * Zones (DS 4.3, `shell/Zones.tsx`): Niwa (the house on WP-07's stage), Engawa (the narrator
 * strip), Zashiki (the futures, seals and the check lane) with the Tokonoma card holding the
 * seals. Every number is a `Num` chip over the engine's evidence; the Checked seal appears only
 * when the mirror agreed with every row and the spec is the real generated one. A home is a
 * sample or a person's own (from onboarding or the store); arriving from onboarding plays the
 * Reveal.
 */
import type { EvidenceId, EvidenceNode, SearchProgress } from '@ibasho/core';
import { ClaimSeal, EvidenceProvider, Num, Seal, staticEvidence } from '@ibasho/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useShell } from '../shell/Shell.tsx';
import { useServices } from '../shell/services.ts';
import { Zones } from '../shell/Zones.tsx';
import { HomeHouse } from './HomeHouse.tsx';
import { findHome } from './homes.ts';
import { type HomeRun, runHome } from './run.ts';
import { type HomeEntry, sampleHome } from './sample.ts';
import { homeView, type PickView } from './view.ts';

const PHASE_WORDS: Record<SearchProgress['phase'], string> = {
  plan: 'Listing what could fit this home',
  heavy: 'Working out the heat each change saves',
  light: 'Trying each way of heating it',
  rules: 'Checking every option against the rules',
  bookkeeping: 'Doing the sums',
  front: 'Finding the options nothing beats',
  evidence: 'Writing down how we know each number',
};

type State =
  | { kind: 'computing'; phase: SearchProgress['phase'] | null }
  | { kind: 'ready'; run: HomeRun }
  | { kind: 'error'; message: string };

type Lookup = { id: string; home: HomeEntry | undefined } | null;

export function HomePage() {
  const { id = '' } = useParams();
  const services = useServices();
  const location = useLocation();
  const reveal = (location.state as { reveal?: unknown } | null)?.reveal === true;
  // Samples resolve at once (no flash); a person's own home may need the store.
  const [lookup, setLookup] = useState<Lookup>(() => {
    const s = sampleHome(id);
    return s ? { id, home: s } : null;
  });
  useEffect(() => {
    if (lookup?.id === id) return;
    let live = true;
    findHome(id, services.store()).then((home) => live && setLookup({ id, home }));
    return () => {
      live = false;
    };
  }, [id, lookup, services]);
  if (!lookup || lookup.id !== id)
    return (
      <p className="ib-empty__wait" aria-live="polite">
        Finding your home
      </p>
    );
  if (!lookup.home) return <UnknownHome id={id} />;
  return <HomeStage key={lookup.home.id} home={lookup.home} reveal={reveal} />;
}

function useHomeRun(home: HomeEntry): [State, () => void] {
  const [state, setState] = useState<State>({ kind: 'computing', phase: null });
  const [attempt, setAttempt] = useState(0);
  const services = useServices();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the search on "Try again"
  useEffect(() => {
    let live = true;
    setState({ kind: 'computing', phase: null });
    services
      .engine()
      .then((engine) =>
        runHome(engine, home, services.store(), (p) => {
          if (live) setState({ kind: 'computing', phase: p.phase });
        }),
      )
      .then(
        (run) => live && setState({ kind: 'ready', run }),
        (e: unknown) =>
          live && setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      live = false;
    };
  }, [home, attempt, services]);
  return [state, useCallback(() => setAttempt((a) => a + 1), [])];
}

function HomeStage({ home, reveal }: { home: HomeEntry; reveal: boolean }) {
  const { theme, reducedMotion } = useShell();
  const [state, retry] = useHomeRun(home);
  const [open, setOpen] = useState<EvidenceId | null>(null);
  const run = state.kind === 'ready' ? state.run : null;
  const view = useMemo(() => (run ? homeView(run.result, run.check.report.ok) : null), [run]);
  const source = useMemo(
    () => staticEvidence(run?.result.graph.nodes ?? [], (ev) => setOpen(ev), 'en-GB'),
    [run],
  );
  const openNode = open ? source.node(open) : undefined;

  return (
    <EvidenceProvider source={source}>
      <Zones
        state={state.kind}
        niwaLabel="Your home"
        niwa={
          <HomeHouse
            twin={home.twin}
            result={run?.result ?? null}
            theme={theme}
            pencil={state.kind !== 'ready'}
            reducedMotion={reducedMotion}
            reveal={reveal}
            title={
              home.sample
                ? `Cutaway drawing of ${home.name.toLowerCase()} in ${home.place}`
                : `Cutaway drawing of your home in ${home.place}`
            }
          />
        }
        caption={
          <>
            <span className="ib-kicker">{home.sample ? 'A sample home' : 'Your home'}</span>
            {home.name}, {home.place}. Drawn from what we know about it; some parts are estimates.
          </>
        }
        engawa={
          state.kind === 'computing' ? (
            <p className="ib-engawa__line" data-phase={state.phase ?? 'start'}>
              <span className="ib-inkstone" aria-hidden="true" />
              {state.phase ? PHASE_WORDS[state.phase] : 'Waking the engine'}
              <span className="ib-sr">, please wait.</span>
            </p>
          ) : state.kind === 'error' ? (
            <div className="ib-mended" role="alert">
              <p className="ib-engawa__line">We could not work this home out.</p>
              <button type="button" className="ib-button" onClick={retry}>
                Try again
              </button>
            </div>
          ) : (
            <p className="ib-engawa__line">
              We tried every combination of the changes we know for this home, kept only those that pass the
              rules, and had a second checker redo the sums. Here is what stands out.
            </p>
          )
        }
        zashiki={
          view && run ? (
            <>
              <section className="ib-tokonoma ib-washi" aria-label="What we checked and proved">
                {view.checked ? (
                  <div className="ib-checked">
                    <Seal
                      level="checked"
                      check={{ rung: run.check.rung, coverage: run.check.coverage }}
                      size="lg"
                      showLabel
                      press={!reducedMotion}
                    />
                    <p className="ib-checked__note">
                      A second checker redid the sums behind every number below and agreed.
                    </p>
                  </div>
                ) : (
                  <p className="ib-checked__note" data-unchecked>
                    The second checker did not agree with these sums, so we show them as modelled only.
                  </p>
                )}
                {view.claims.map((c) => (
                  <ClaimSeal
                    key={c.id}
                    // Theorem names live on /app/proofs (SPEC R11); the home page stays plain.
                    claim={{ ...c, theorems: [] }}
                    variant="inline"
                    statement="Anything you rule out stays out of every future we offer you, until you bring it back."
                    press={!reducedMotion}
                  />
                ))}
              </section>

              <section className="ib-futures" aria-labelledby="futures-title">
                <h2 id="futures-title" className="ib-h2">
                  Three futures
                </h2>
                <div className="ib-futures__grid">
                  {view.picks.map((p) => (
                    <FutureCard key={p.key} pick={p} checked={view.checked} />
                  ))}
                </div>
              </section>

              {view.lane.length > 0 ? (
                <section className="ib-lane" aria-labelledby="lane-title">
                  <h2 id="lane-title" className="ib-h3">
                    Possible after a check
                  </h2>
                  <ul className="ib-lane__list">
                    {view.lane.map((l) => (
                      <li key={l.packageId}>
                        <strong>{l.name}</strong>
                        <span>{l.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <p className="ib-kept">
                {run.kept
                  ? 'Kept on this device only.'
                  : 'Not kept: this browser has no local storage for us.'}
              </p>
            </>
          ) : (
            <div className="ib-zashiki__waiting" aria-hidden="true">
              <div className="ib-ghost" />
              <div className="ib-ghost" />
              <div className="ib-ghost" />
            </div>
          )
        }
      />
      {openNode ? <EvidenceNote node={openNode} onClose={() => setOpen(null)} /> : null}
    </EvidenceProvider>
  );
}

function FutureCard({ pick, checked }: { pick: PickView; checked: boolean }) {
  return (
    <article className="ib-future ib-washi" data-pick={pick.key}>
      <h3 className="ib-future__title">{pick.title}</h3>
      <p className="ib-future__name">{pick.name}</p>
      {pick.sameAs ? (
        <p className="ib-future__same">The same change as {pick.sameAs.toLowerCase()}.</p>
      ) : null}
      <dl className="ib-future__figures">
        {pick.figures.map((f) => (
          <div key={f.ev} className="ib-figure">
            <dt>{f.label}</dt>
            <dd>
              <Num
                ev={f.ev}
                {...(checked ? { seal: 'checked' as const } : {})}
                {...(f.delta ? { delta: f.delta } : {})}
              />
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

/** PLACEHOLDER for the evidence drawer (DS 8 `EvidenceDrawer`, M-C): the formula in words. */
function EvidenceNote({ node, onClose }: { node: EvidenceNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <aside className="ib-sheet" aria-label="How we know this number">
      <p className="ib-kicker">How we know</p>
      <p className="ib-sheet__value">
        <Num ev={node.id} />
      </p>
      <p className="ib-sheet__words">{node.formula.doc}</p>
      <button type="button" className="ib-button" onClick={onClose}>
        Close
      </button>
    </aside>
  );
}

function UnknownHome({ id }: { id: string }) {
  return (
    <div className="ib-empty ib-washi">
      <p className="ib-kicker">Not found</p>
      <h1 className="ib-h2">We do not know a home called “{id}”.</h1>
      <p>
        <Link to="/home/gh1">See the sample home</Link>
      </p>
    </div>
  );
}
