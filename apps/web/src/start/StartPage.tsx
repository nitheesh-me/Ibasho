/**
 * `/app/start`, onboarding in five steps (SPEC 5.2, UX 5). Owner: WP-08.
 *
 * Where, Shape, Tune, People, then Reveal on the home stage. The step lives in React state. From
 * Tune on, a person can jump straight to Reveal; nothing after Shape is required, and anything not
 * answered stays an estimate that the page marks as one (AC-G2). No step asks for a budget (R24).
 * Works offline: the place list and postcode reading are local (AC-G3).
 */
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { holdHome } from '../home/homes.ts';
import type { HomeEntry } from '../home/sample.ts';
import { useServices } from '../shell/services.ts';
import { ARCHETYPES, archetypeById } from './archetypes.ts';
import { Picture, Thumb } from './Pictures.tsx';
import { PLACES, placeById, readPostcode } from './places.ts';
import { TUNE_QUESTIONS } from './questions.ts';
import {
  type Answers,
  BOILER_AGE,
  type BoilerAge,
  EMPTY_ANSWERS,
  SeedError,
  seedHome,
  TENURE_LINES,
  type Tenure,
} from './seed.ts';
import { SKIP_FROM, STEPS, type StepId, stepIndex } from './steps.ts';

/** Location state the home stage reads to play the Reveal. */
export interface RevealState {
  reveal: true;
}

const ESTIMATE_NOTE = 'Not sure: we keep an estimate from homes like yours.';

export function StartPage() {
  const [step, setStep] = useState<StepId>('where');
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const services = useServices();
  const at = stepIndex(step);
  const current = STEPS[at] ?? STEPS[0]!;
  const set = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }));

  const canNext =
    step === 'where' ? answers.placeId !== null : step === 'shape' ? answers.tileId !== null : true;
  const canSkip = at >= stepIndex(SKIP_FROM) && step !== 'reveal';

  async function reveal() {
    setError(null);
    let home: HomeEntry;
    try {
      home = seedHome(answers);
    } catch (e) {
      setError(e instanceof SeedError ? `Almost there: ${e.message}.` : 'We could not draw this home.');
      return;
    }
    setBusy(true);
    holdHome(home);
    // Ask the browser to keep our data (SPEC 6: at Reveal, inside the person's click). Asked before
    // any await, so the click still counts as a user gesture where the browser requires one.
    try {
      void navigator.storage?.persist?.();
    } catch {
      // Not supported here.
    }
    const store = services.store();
    if (store) {
      try {
        await store.twins.append(home.twin, home.name);
      } catch {
        // Not kept: the home stage says so.
      }
    }
    navigate(`/home/${home.id}`, { state: { reveal: true } satisfies RevealState });
  }

  function next() {
    if (!canNext) return;
    const following = STEPS[at + 1];
    if (!following || following.id === 'reveal') void reveal();
    else setStep(following.id);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    next();
  };

  return (
    <div className="ib-start">
      <nav className="ib-steps" aria-label="Steps">
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.id} data-done={i < at || undefined} aria-current={s.id === step ? 'step' : undefined}>
              <span className="ib-steps__n" aria-hidden="true">
                {['一', '二', '三', '四', '五'][i]}
              </span>
              <span>{s.title}</span>
            </li>
          ))}
        </ol>
      </nav>

      <form className="ib-start__card ib-washi" onSubmit={onSubmit} aria-labelledby="start-title">
        <p className="ib-kicker">Step {['one', 'two', 'three', 'four', 'five'][at]} of five</p>
        <h1 id="start-title" className="ib-h2">
          {current.prompt}
        </h1>

        {step === 'where' ? <Where answers={answers} set={set} /> : null}
        {step === 'shape' ? <Shape answers={answers} set={set} /> : null}
        {step === 'tune' ? <Tune answers={answers} set={set} /> : null}
        {step === 'people' ? <People answers={answers} set={set} /> : null}

        {error ? (
          <p className="ib-start__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ib-start__actions">
          {at > 0 ? (
            <button type="button" className="ib-button" onClick={() => setStep(STEPS[at - 1]!.id)}>
              Back
            </button>
          ) : null}
          {step === 'people' ? (
            <button type="submit" className="ib-hero-action" disabled={busy}>
              Show my home
            </button>
          ) : (
            <button type="submit" className="ib-button ib-button--ink" disabled={!canNext || busy}>
              Next
            </button>
          )}
          {canSkip && step !== 'people' ? (
            <button type="button" className="ib-link" onClick={() => void reveal()} disabled={busy}>
              Skip to my home
            </button>
          ) : null}
        </div>
        <p className="ib-start__sample">
          <Link to="/home/gh1">Show me a sample home</Link>
        </p>
      </form>
    </div>
  );
}

interface StepProps {
  answers: Answers;
  set: (patch: Partial<Answers>) => void;
}

function Where({ answers, set }: StepProps) {
  const [postcode, setPostcode] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const pcId = useId();
  const chosen = answers.placeId ? placeById(answers.placeId) : undefined;

  function applyPostcode() {
    const r = readPostcode(postcode);
    if (r.kind === 'invalid') {
      setNote('That does not look like a UK postcode. You can pick a city instead.');
      return;
    }
    if (r.kind === 'unlisted') {
      setNote('We do not have that area yet. Pick the nearest city below.');
      return;
    }
    setNote(null);
    set({ placeId: r.place.id, postcodeArea: r.area });
  }

  return (
    <>
      <div className="ib-postcode">
        <label htmlFor={pcId}>Postcode</label>
        <div className="ib-postcode__row">
          <input
            id={pcId}
            className="ib-input"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyPostcode();
              }
            }}
            autoComplete="postal-code"
            inputMode="text"
            spellCheck={false}
          />
          <button type="button" className="ib-button" onClick={applyPostcode}>
            Use it
          </button>
        </div>
        <p className="ib-hint">Read on this device only; nothing is looked up or sent.</p>
        {note ? <p className="ib-hint ib-hint--warn">{note}</p> : null}
      </div>
      <Choices
        legend="Or pick the nearest city"
        name="place"
        value={answers.placeId}
        onChange={(id) => set({ placeId: id, postcodeArea: undefined })}
        options={PLACES.map((p) => ({ id: p.id, label: p.name }))}
        layout="chips"
      />
      {chosen && !chosen.ownWeather ? (
        <p className="ib-hint">We use London’s typical weather until {chosen.name}’s is added.</p>
      ) : null}
    </>
  );
}

function Shape({ answers, set }: StepProps) {
  const chosen = answers.tileId ? archetypeById(answers.tileId) : undefined;
  return (
    <>
      <Choices
        legend="Home type"
        hideLegend
        name="shape"
        value={answers.tileId}
        onChange={(id) => set({ tileId: id })}
        layout="grid"
        options={ARCHETYPES.map((a) => ({
          id: a.id,
          label: a.label,
          detail: a.seedable ? undefined : 'Not drawn yet',
          disabled: !a.seedable,
          picture: <Thumb kind={a.thumb} />,
          describe: a.alt,
        }))}
      />
      {chosen?.id === 'not-sure' ? (
        <p className="ib-hint">We start from the most common home near you and keep every range wide.</p>
      ) : null}
    </>
  );
}

function Tune({ answers, set }: StepProps) {
  return (
    <div className="ib-tune">
      {TUNE_QUESTIONS.map((q) => {
        const value = answers.tune[q.id] ?? null;
        return (
          <Choices
            key={q.id}
            legend={q.prompt}
            note={q.why}
            name={`tune-${q.id}`}
            value={value ?? 'not-sure'}
            onChange={(id) => {
              const tune = { ...answers.tune };
              if (id === 'not-sure') delete tune[q.id];
              else tune[q.id] = id;
              set({ tune });
            }}
            layout={q.choices.some((c) => c.picture) ? 'pictures' : 'chips'}
            estimated={value === null}
            options={[
              ...q.choices.map((c) => ({
                id: c.id,
                label: c.label,
                picture: c.picture ? <Picture id={c.picture} /> : undefined,
              })),
              { id: 'not-sure', label: 'Not sure' },
            ]}
          />
        );
      })}
    </div>
  );
}

function People({ answers, set }: StepProps) {
  const tenure = answers.tenure;
  return (
    <div className="ib-tune">
      <Choices
        legend="Is it yours?"
        name="tenure"
        value={tenure}
        onChange={(id) => set({ tenure: id as Tenure })}
        layout="chips"
        estimated={tenure === null}
        options={(Object.keys(TENURE_LINES) as Tenure[]).map((t) => ({
          id: t,
          label: TENURE_LINES[t].label,
        }))}
      />
      {tenure ? <p className="ib-hint">{TENURE_LINES[tenure].line}</p> : null}
      <Choices
        legend="How many people live here?"
        name="people"
        value={answers.people === null ? null : String(answers.people)}
        onChange={(id) => set({ people: Number(id) })}
        layout="chips"
        estimated={answers.people === null}
        options={[
          { id: '1', label: 'One' },
          { id: '2', label: 'Two' },
          { id: '3', label: 'Three' },
          { id: '4', label: 'Four' },
          { id: '5', label: 'Five or more' },
        ]}
      />
      <Choices
        legend="How old is the boiler?"
        name="boiler"
        value={answers.boilerAge ?? 'not-sure'}
        onChange={(id) => set({ boilerAge: id === 'not-sure' ? null : (id as BoilerAge) })}
        layout="chips"
        estimated={answers.boilerAge === null}
        options={[
          ...(Object.keys(BOILER_AGE) as BoilerAge[]).map((b) => ({ id: b, label: BOILER_AGE[b].label })),
          { id: 'not-sure', label: 'Not sure' },
        ]}
      />
    </div>
  );
}

interface Option {
  id: string;
  label: string;
  detail?: string | undefined;
  disabled?: boolean;
  picture?: ReactNode;
  describe?: string;
}

function Choices(props: {
  legend: string;
  hideLegend?: boolean;
  note?: string;
  name: string;
  value: string | null;
  onChange: (id: string) => void;
  options: Option[];
  layout: 'chips' | 'grid' | 'pictures';
  /** True while the answer is a default: the group says so (AC-G2). */
  estimated?: boolean;
}) {
  const base = useId();
  return (
    <fieldset className="ib-choices" data-layout={props.layout} data-estimated={props.estimated || undefined}>
      <legend className={props.hideLegend ? 'ib-sr' : 'ib-choices__legend'}>{props.legend}</legend>
      {props.note ? <p className="ib-hint">{props.note}</p> : null}
      <div className="ib-choices__list">
        {props.options.map((o) => {
          const id = `${base}-${o.id}`;
          return (
            <label key={o.id} className="ib-choice" htmlFor={id} data-disabled={o.disabled || undefined}>
              <input
                id={id}
                type="radio"
                name={props.name}
                value={o.id}
                checked={props.value === o.id}
                disabled={o.disabled}
                onChange={() => props.onChange(o.id)}
                {...(o.describe ? { 'aria-describedby': `${id}-d` } : {})}
              />
              {o.picture ? <span className="ib-choice__pic">{o.picture}</span> : null}
              <span className="ib-choice__label">{o.label}</span>
              {o.detail ? <span className="ib-choice__detail">{o.detail}</span> : null}
              {o.describe ? (
                <span id={`${id}-d`} className="ib-sr">
                  {o.describe}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      {props.estimated ? (
        <p className="ib-estimated">
          <span className="ib-estimated__mark" aria-hidden="true" />
          {ESTIMATE_NOTE}
        </p>
      ) : null}
    </fieldset>
  );
}
