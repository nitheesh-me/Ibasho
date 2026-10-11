/**
 * Settings ledger (SPEC 24, UV 7). Owner: WP-08.
 *
 * Groups: Money, Carbon, Comfort, Codes and targets, Weather, Analysis resolution, Render quality,
 * Display, Privacy. Each row shows its value, unit, origin chip, grade, scope and "changes N
 * numbers", where N is exactly the stale set over the numbers on screen (AC-SET2). A change is
 * previewed before Apply: the count, and a before and after of the headline numbers.
 */
import { affectsMatch, type Place, SETTING_GROUPS } from '@ibasho/core';
import {
  ChoiceChips,
  EvidenceProvider,
  LedgerRow,
  Num,
  PreviewStamp,
  Stepper,
  staticEvidence,
} from '@ibasho/ui';
import { useMemo, useState } from 'react';
import { headline } from '../preview/runner.ts';
import { BASE_LEVERS, SETTING_GROUP_LABEL, SETTINGS, type SettingSpec } from '../preview/settings.ts';
import { BASE_VARIANT, jobKey, useStudio } from '../state/studio.ts';

export function SettingsPage() {
  const settings = useStudio((s) => s.settings);
  const userSet = useStudio((s) => s.userSet);
  const jobs = useStudio((s) => s.jobs);
  const buildings = useStudio((s) => s.buildings);
  const places = useStudio((s) => s.places);
  const st = useStudio.getState();
  const [pending, setPending] = useState<{ id: string; value: number | string } | null>(null);
  const [depth, setDepth] = useState<'plain' | 'pro'>(
    String(settings['display.depth']) === 'plain' ? 'plain' : 'pro',
  );

  // Every quantity currently on screen (all jobs), for the "changes N numbers" count.
  const present = useMemo(() => {
    const qs = new Set<string>();
    for (const j of Object.values(jobs))
      for (const list of Object.values(j.nodes)) for (const n of list ?? []) qs.add(n.quantity);
    return [...qs];
  }, [jobs]);
  const count = (s: SettingSpec) =>
    s.stage ? present.filter((q) => s.affects.some((p) => affectsMatch(p, q))).length : undefined;

  const hero = buildings.gb1 ?? Object.values(buildings)[0];
  const impact = useMemo(() => {
    if (!pending || !hero) return undefined;
    const base = {
      placeId: hero.placeId,
      variantId: 'as-built',
      doc: hero.doc,
      levers: BASE_LEVERS,
      resolution: 'standard' as const,
      asOf: new Date().toISOString(),
      place: places[hero.placeId]?.place as Place,
      tiles: [],
    };
    const before = headline({ ...base, key: 'set-before', settings });
    const after = headline({
      ...base,
      key: 'set-after',
      settings: { ...settings, [pending.id]: pending.value },
    });
    return {
      before: before.view,
      after: after.view,
      src: staticEvidence([...before.nodes, ...after.nodes], undefined, 'en-IN'),
    };
  }, [pending, hero, settings, places]);

  const jobOn = hero ? jobs[jobKey(hero.id, BASE_VARIANT)] : undefined;

  return (
    <div className="st-settings">
      <header className="st-home__head">
        <p className="st-kicker">Settings</p>
        <h1 className="st-home__title">Rates, levels and assumptions</h1>
        <p className="st-home__lede">
          Every value says where it came from and how many numbers it changes. Preset: Hyderabad 2026
          defaults.
        </p>
        <ChoiceChips
          id="depth"
          label="Depth"
          value={depth}
          onChange={(d) => {
            setDepth(d);
            st.setSetting('display.depth', d);
          }}
          choices={[
            { value: 'plain', label: 'Plain' },
            { value: 'pro', label: 'Pro: show every setting' },
          ]}
        />
      </header>
      {pending ? (
        <div className="st-impact ib-plate" role="status">
          <p>
            This changes <code>{count(SETTINGS.find((s) => s.id === pending.id) as SettingSpec) ?? 0}</code>{' '}
            numbers and may reorder your picks.
          </p>
          {impact ? (
            <EvidenceProvider source={impact.src}>
              <dl className="st-impact__table">
                <div>
                  <dt>Bill, {hero?.name}</dt>
                  <dd>
                    <Num ev={impact.before.bill} size="ui" /> <span aria-hidden="true">→</span>{' '}
                    <Num ev={impact.after.bill} size="ui" />
                  </dd>
                </div>
                <div>
                  <dt>EUI</dt>
                  <dd>
                    <Num ev={impact.before.eui} size="ui" /> <span aria-hidden="true">→</span>{' '}
                    <Num ev={impact.after.eui} size="ui" />
                  </dd>
                </div>
              </dl>
              <PreviewStamp compact />
            </EvidenceProvider>
          ) : null}
          <div className="st-impact__actions">
            <button
              type="button"
              className="ib-btn"
              onClick={() => {
                st.setSetting(pending.id, pending.value);
                setPending(null);
              }}
            >
              Apply
            </button>
            <button type="button" className="ib-link" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {jobOn ? null : (
        <p className="st-note">Open a building once to see how many of its numbers each setting changes.</p>
      )}
      {SETTING_GROUPS.map((g) => {
        const rows = SETTINGS.filter((s) => s.group === g && (depth === 'pro' || s.depth === 'plain'));
        if (!rows.length) return null;
        return (
          <section key={g} className="st-ledger" aria-label={SETTING_GROUP_LABEL[g]}>
            <h2 className="st-ledger__title">{SETTING_GROUP_LABEL[g]}</h2>
            {rows.map((s) => {
              const value = pending?.id === s.id ? pending.value : (settings[s.id] ?? s.value);
              const affects = count(s);
              return (
                <LedgerRow
                  key={s.id}
                  label={s.label}
                  {...(s.hint ? { hint: s.hint } : {})}
                  {...(s.unit ? { unit: s.unit } : {})}
                  origin={userSet[s.id] ? 'user' : 'default'}
                  source={s.source}
                  grade={s.grade}
                  scope={s.scopes[0] ?? 'app'}
                  depth={s.depth}
                  {...(affects !== undefined ? { affects } : {})}
                  pending={pending?.id === s.id}
                  onReset={() => st.resetSetting(s.id)}
                  control={(id) =>
                    s.kind === 'number' ? (
                      <Stepper
                        id={id}
                        label={s.label}
                        value={Number(value)}
                        step={s.step ?? 1}
                        min={s.min ?? 0}
                        max={s.max ?? 100}
                        {...(s.decimals ? { decimals: s.decimals } : {})}
                        onChange={(v) =>
                          s.stage ? setPending({ id: s.id, value: v }) : st.setSetting(s.id, v)
                        }
                      />
                    ) : (
                      <ChoiceChips
                        id={id}
                        label={s.label}
                        value={String(value)}
                        choices={s.choices ?? []}
                        onChange={(v) =>
                          s.stage ? setPending({ id: s.id, value: v }) : st.setSetting(s.id, v)
                        }
                      />
                    )
                  }
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
