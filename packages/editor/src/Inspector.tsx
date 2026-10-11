/**
 * Inspector, storey stack, facade panel and plan outline (SPEC 20, BE 3.3, UV 5). Owner: WP-15.
 *
 * The properties sheet that replaces the Zashiki in Make mode. Every change goes through
 * `onEdit(label, recipe)`. Geometry values are document inputs (drawing dimensions), shown in
 * `code` like a dimension string; results never appear here. Live meters (WWR, projection factor)
 * are quiet chips with the clause they read; a failing meter uses warm text with a sign, never
 * vermilion.
 */
import type { BuildingDoc, FacadeBin, Room2D, ShadeRule, Storey } from '@ibasho/core';
import { ChoiceChips, Picker, Range, Stepper } from '@ibasho/ui';
import { useId, useState } from 'react';
import { ECBC_WWR_LIMIT_PM, type FacadeMeter, facadeMeters } from './checks.ts';
import { areaM2, edge, edgeBin, edgeLength } from './geom.ts';
import {
  addStoreyAbove,
  type Recipe,
  removeStorey,
  renameRoom,
  setFacade,
  setRoomFunction,
  setShading,
  setStorey,
  setWindow,
} from './ops.ts';
import { SPACE_FUNCTIONS, spaceFunction, TYPE_FUNCTIONS } from './spaces.ts';

type OnEdit = (label: string, recipe: Recipe) => void;

export const SHADE_PRESETS: { id: string; label: string; rules: ShadeRule[] }[] = [
  { id: 'none', label: 'None', rules: [] },
  {
    id: 'chajja',
    label: 'Chajja',
    rules: [{ kind: 'overhang', depth: 600, aboveHead: 150, extension: 300 }],
  },
  {
    id: 'deep',
    label: 'Deep overhang',
    rules: [{ kind: 'overhang', depth: 1200, aboveHead: 150, extension: 600 }],
  },
  { id: 'fins', label: 'Fins', rules: [{ kind: 'fins', depth: 450, sides: 'both' }] },
  {
    id: 'box',
    label: 'Box frame',
    rules: [
      { kind: 'overhang', depth: 600, aboveHead: 150, extension: 0 },
      { kind: 'fins', depth: 600, sides: 'both' },
    ],
  },
  {
    id: 'jaali',
    label: 'Jaali',
    rules: [{ kind: 'screen', porosityPm: 400, offset: 300, presetId: 'jaali' }],
  },
];

export function presetOf(rules: readonly ShadeRule[]): string {
  const key = JSON.stringify(rules);
  return SHADE_PRESETS.find((p) => JSON.stringify(p.rules) === key)?.id ?? (rules.length ? 'custom' : 'none');
}

export function MeterChip({
  label,
  valuePm,
  limitPm,
  clause,
}: {
  label: string;
  valuePm: number;
  limitPm?: number;
  clause: string;
}) {
  const fail = limitPm !== undefined && valuePm > limitPm;
  return (
    <span
      className="ib-meter"
      data-fail={fail ? '' : undefined}
      title={`${clause}. Live plan meter, no simulation.`}
    >
      <span className="ib-meter__label">{label}</span>
      <code className="ib-meter__value">{(valuePm / 10).toFixed(0)}%</code>
      {limitPm !== undefined ? (
        <span className="ib-meter__limit">
          {fail ? '▲ over ' : 'within '}
          <code>{(limitPm / 10).toFixed(0)}%</code>
        </span>
      ) : null}
    </span>
  );
}

export interface InspectorProps {
  doc: BuildingDoc;
  storeyId: string;
  selection: readonly string[];
  segId?: string | undefined;
  onEdit: OnEdit;
  /** Phone: light edits only. */
  limited?: boolean;
  /** Pick which outside wall the window and shading controls edit. */
  onSegment?: (segId: string) => void;
}

export function Inspector({ doc, storeyId, selection, segId, onEdit, limited, onSegment }: InspectorProps) {
  const storey = doc.storeys.find((s) => s.id === storeyId);
  const rooms = (storey?.rooms ?? []).filter((r) => selection.includes(r.id)) as Room2D[];
  const nameId = useId();
  const fnId = useId();
  if (!storey) return null;
  if (rooms.length === 0) {
    return (
      <section className="ib-insp" aria-label="Properties">
        <p className="ib-insp__empty">
          Pick a room on the plan, or use the outline below, to see its function, windows and shading.
        </p>
        <FacadePanel doc={doc} onEdit={onEdit} />
      </section>
    );
  }
  const room = rooms[0] as Room2D;
  const fn = spaceFunction(room.spaceTypeId);
  const offered = TYPE_FUNCTIONS[doc.typeId] ?? [];
  const ordered = [...SPACE_FUNCTIONS].sort(
    (a, b) => Number(!offered.includes(a.id)) - Number(!offered.includes(b.id)),
  );
  const outdoor = room.segments
    .map((s, i) => ({
      s,
      i,
      bin: edgeBin(room.floor.outer, i, doc.rotationMdeg),
      len: edgeLength(edge(room.floor.outer, i)),
    }))
    .filter((x) => x.s.boundary.kind === 'outdoors');
  const focus = outdoor.find((x) => x.s.id === segId) ?? outdoor[0];
  const ids = rooms.map((r) => r.id);

  return (
    <section className="ib-insp" aria-label="Properties">
      <header className="ib-insp__head">
        <span className="ib-insp__kicker">{rooms.length > 1 ? `${rooms.length} rooms` : 'Room'}</span>
        <h3 className="ib-insp__title">{room.name ?? fn?.label ?? 'Unknown use'}</h3>
        <code className="ib-insp__dim">
          {areaM2(room.floor).toFixed(1)} m², {storey.name}
        </code>
      </header>

      {rooms.length === 1 && !limited ? (
        <div className="ib-insp__row">
          <label htmlFor={nameId}>Name</label>
          <input
            id={nameId}
            className="ib-field"
            defaultValue={room.name ?? ''}
            key={room.id}
            placeholder={fn?.label ?? 'Room name'}
            onBlur={(e) => {
              if ((e.target.value || undefined) !== room.name)
                onEdit('Rename room', renameRoom(storey.id, room.id, e.target.value));
            }}
          />
        </div>
      ) : null}

      <div className="ib-insp__row">
        <Picker
          id={fnId}
          label="Function"
          value={room.spaceTypeId ?? '__none'}
          options={[
            { value: '__none', label: 'Not known yet', hint: 'Widens the energy range' },
            ...ordered.map((f) => ({
              value: f.id,
              label: f.label,
              group: offered.includes(f.id) ? 'Usual for this type' : 'Other uses',
            })),
          ]}
          onChange={(v) =>
            onEdit(
              v !== '__none' ? `Set ${spaceFunction(v)?.label}` : 'Clear function',
              setRoomFunction(storey.id, ids, v === '__none' ? undefined : v),
            )
          }
        />
      </div>

      {focus ? (
        <>
          <h4 className="ib-insp__sub">
            Window on the {focus.bin} wall <code>{(focus.len / 1000).toFixed(1)} m</code>
          </h4>
          {outdoor.length > 1 ? (
            <ChoiceChips
              id={`${fnId}-walls`}
              label="Wall"
              value={focus.s.id}
              choices={outdoor.map((o) => ({ value: o.s.id, label: o.bin }))}
              onChange={(id) => onSegment?.(id)}
            />
          ) : null}
          <WindowControls
            key={focus.s.id}
            value={focus.s.window.kind === 'ratio' ? focus.s.window.wwrPm : 0}
            onChange={(wwrPm) =>
              onEdit(
                `Window ${wwrPm / 10}% on the ${focus.bin} wall`,
                setWindow(
                  storey.id,
                  room.id,
                  focus.s.id,
                  wwrPm > 0 ? { kind: 'ratio', wwrPm, sill: 900, head: 2400 } : { kind: 'none' },
                ),
              )
            }
          />
          <h4 className="ib-insp__sub">Shading on that wall</h4>
          <ChoiceChips
            id={`${fnId}-shade`}
            label="Shading preset"
            value={presetOf(focus.s.shading)}
            choices={SHADE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(id) => {
              const p = SHADE_PRESETS.find((x) => x.id === id);
              if (p)
                onEdit(
                  `${p.label} on the ${focus.bin} wall`,
                  setShading(storey.id, room.id, focus.s.id, p.rules),
                );
            }}
          />
        </>
      ) : (
        <p className="ib-insp__note">This room has no outside wall, so it has no windows of its own.</p>
      )}
      <FacadePanel doc={doc} onEdit={onEdit} compact />
    </section>
  );
}

function WindowControls({ value, onChange }: { value: number; onChange: (pm: number) => void }) {
  return (
    <div className="ib-insp__row">
      <Range
        label="Window share of the wall"
        value={value / 10}
        min={0}
        max={90}
        step={5}
        mark={{ at: 40, label: 'ECBC 40% limit' }}
        format={(v) => `${v}%`}
        onChange={(v) => onChange(Math.round(v * 10))}
      />
    </div>
  );
}

/** Facade-wide window and shading levers: "same on every floor" by default (UV 5.2). */
export function FacadePanel({
  doc,
  onEdit,
  compact = false,
}: {
  doc: BuildingDoc;
  onEdit: OnEdit;
  compact?: boolean;
}) {
  const meters = facadeMeters(doc);
  return (
    <section className="ib-facades" aria-label="Facades">
      <h4 className="ib-insp__sub">Facades, every floor</h4>
      <ul className="ib-facades__list">
        {meters.map((m) => (
          <FacadeRow key={m.bin} m={m} onEdit={onEdit} compact={compact} />
        ))}
      </ul>
      <p className="ib-insp__note">
        Meters read the plan only: ECBC 2017 4.3.2 window limit (estimate grade until checked against the code
        text).
      </p>
    </section>
  );
}

function FacadeRow({ m, onEdit, compact }: { m: FacadeMeter; onEdit: OnEdit; compact: boolean }) {
  return (
    <li className="ib-facades__row" data-compact={compact ? '' : undefined}>
      <span className="ib-facades__bin">{m.bin}</span>
      <MeterChip label="WWR" valuePm={m.wwrPm} limitPm={ECBC_WWR_LIMIT_PM} clause="ECBC 2017 4.3.2(a)" />
      {m.pf !== undefined ? (
        <MeterChip label="PF" valuePm={Math.round(m.pf * 1000)} clause="ECBC projection factor" />
      ) : null}
      {compact ? null : (
        <>
          <Range
            label={`Window share facing ${m.bin}`}
            hideLabel
            value={Math.round(m.wwrPm / 50) * 5}
            min={0}
            max={80}
            step={5}
            mark={{ at: 40, label: 'ECBC 40% limit' }}
            format={(v) => `${v}%`}
            onChange={(v) =>
              onEdit(`Windows ${v}% facing ${m.bin}`, setFacade('all', m.bin as FacadeBin, { wwrPm: v * 10 }))
            }
          />
          <Picker
            label={`Shading facing ${m.bin}`}
            hideLabel
            value={undefined}
            placeholder="Shade"
            options={SHADE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(id) => {
              const p = SHADE_PRESETS.find((x) => x.id === id);
              if (p)
                onEdit(
                  `${p.label} facing ${m.bin}`,
                  setFacade('all', m.bin as FacadeBin, { shading: p.rules }),
                );
            }}
          />
        </>
      )}
    </li>
  );
}

export interface StoreyStackProps {
  doc: BuildingDoc;
  storeyId: string;
  onStorey: (id: string) => void;
  onEdit: OnEdit;
  limited?: boolean;
}

/** Storeys top to bottom: pick, add above (copy rooms, footprint or empty), floor height, repeat, cellar. */
export function StoreyStack({ doc, storeyId, onStorey, onEdit, limited }: StoreyStackProps) {
  const [copy, setCopy] = useState<'rooms' | 'footprint' | 'empty'>('rooms');
  const top = [...doc.storeys].reverse();
  return (
    <section className="ib-storeys" aria-label="Storeys">
      <ol className="ib-storeys__list">
        {top.map((s: Storey) => (
          <li
            key={s.id}
            className="ib-storeys__row"
            data-current={s.id === storeyId ? '' : undefined}
            data-below={s.belowGrade ? '' : undefined}
          >
            <button
              type="button"
              className="ib-storeys__pick"
              aria-current={s.id === storeyId ? 'true' : undefined}
              onClick={() => onStorey(s.id)}
            >
              <span className="ib-storeys__slab" aria-hidden="true" />
              <span className="ib-storeys__name">{s.name}</span>
              <code className="ib-storeys__dim">
                {s.multiplier > 1 ? `×${s.multiplier}, ` : ''}
                {(s.floorToFloor / 1000).toFixed(1)} m
              </code>
            </button>
            {s.id === storeyId && !limited ? (
              <div className="ib-storeys__edit">
                <Stepper
                  id={`ftf-${s.id}`}
                  label="floor to floor height"
                  value={s.floorToFloor / 1000}
                  step={0.1}
                  min={2.4}
                  max={8}
                  decimals={1}
                  onChange={(m) =>
                    onEdit('Floor height', setStorey(s.id, { floorToFloor: Math.round(m * 1000) }))
                  }
                />
                <Stepper
                  id={`mul-${s.id}`}
                  label="repeat"
                  value={s.multiplier}
                  step={1}
                  min={1}
                  max={60}
                  onChange={(n) => onEdit('Repeat storey', setStorey(s.id, { multiplier: n }))}
                />
                {doc.storeys.length > 1 ? (
                  <button
                    type="button"
                    className="ib-link"
                    onClick={() => onEdit(`Remove ${s.name}`, removeStorey(s.id))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {limited ? null : (
        <div className="ib-storeys__add">
          <ChoiceChips
            id="storey-copy"
            label="New storey copies"
            value={copy}
            choices={[
              { value: 'rooms', label: 'Rooms' },
              { value: 'footprint', label: 'Walls only' },
              { value: 'empty', label: 'Empty' },
            ]}
            onChange={setCopy}
          />
          <button
            type="button"
            className="ib-btn"
            onClick={() => {
              const id = `st_${Math.random().toString(36).slice(2, 8)}`;
              onEdit('Add storey above', addStoreyAbove(storeyId, copy, id));
              onStorey(id);
            }}
          >
            Add a storey above
          </button>
        </div>
      )}
    </section>
  );
}

/** The non-visual plan outline: every storey and room reachable by keyboard (AC-ED3). */
export function PlanOutline({
  doc,
  storeyId,
  selection,
  onStorey,
  onSelect,
}: {
  doc: BuildingDoc;
  storeyId: string;
  selection: readonly string[];
  onStorey: (id: string) => void;
  onSelect: (ids: string[]) => void;
}) {
  const s = doc.storeys.find((x) => x.id === storeyId);
  return (
    <nav className="ib-outline" aria-label="Plan outline">
      <details>
        <summary>Rooms on {s?.name ?? 'this storey'} (outline)</summary>
        <ul>
          {(s?.rooms ?? []).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="ib-link"
                aria-pressed={selection.includes(r.id)}
                onClick={() => onSelect([r.id])}
              >
                {r.name ?? spaceFunction(r.spaceTypeId)?.label ?? 'Unknown use'}
              </button>
            </li>
          ))}
        </ul>
        <p>
          Other storeys:{' '}
          {doc.storeys
            .filter((x) => x.id !== storeyId)
            .map((x) => (
              <button key={x.id} type="button" className="ib-link" onClick={() => onStorey(x.id)}>
                {x.name}
              </button>
            ))}
        </p>
      </details>
    </nav>
  );
}
