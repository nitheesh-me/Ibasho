/**
 * Make mode properties sheet (SPEC 20, UV 5). Owner: WP-08 (host), WP-15 (editor parts).
 *
 * Storeys, the selected room's function, windows and shading, facade levers, the plan outline,
 * the underlay for tracing, and the film strip of versions with the EUI after each.
 */
import type { BuildingDoc, EvidenceNode } from '@ibasho/core';
import { Inspector, PlanOutline, type Recipe, StoreyStack, setUnderlay } from '@ibasho/editor';
import { EvidenceProvider, FilmStrip, Range, Stepper } from '@ibasho/ui';
import { useMemo } from 'react';
import { agoWords } from '../hooks.ts';
import { type BuildingEntry, useStudio } from '../state/studio.ts';
import { Card } from './Summary.tsx';

export interface MakePanelProps {
  b: BuildingEntry;
  storeyId: string;
  onStorey: (id: string) => void;
  selection: string[];
  segId: string | undefined;
  onSelect: (ids: string[], seg?: string) => void;
  limited: boolean;
  underlays: Record<string, string>;
  onUnderlay: (storeyId: string, url: string | undefined) => void;
}

export function DocThumb({ doc }: { doc: BuildingDoc }) {
  const s = doc.storeys.find((x) => !x.belowGrade) ?? doc.storeys[0];
  const pts = s?.rooms.flatMap((r) => r.floor.outer) ?? [];
  if (!s || !pts.length) return <svg viewBox="0 0 10 6" aria-hidden="true" />;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1;
  const h = Math.max(...ys) - y0 || 1;
  const k = Math.min(96 / w, 52 / h);
  return (
    <svg viewBox="0 0 100 56" className="st-thumb" aria-hidden="true">
      {s.rooms.map((r) => (
        <polygon
          key={r.id}
          points={r.floor.outer.map((p) => `${2 + (p[0] - x0) * k},${54 - (p[1] - y0) * k}`).join(' ')}
          data-untyped={r.spaceTypeId ? undefined : ''}
        />
      ))}
    </svg>
  );
}

export function MakePanel(p: MakePanelProps) {
  const st = useStudio.getState();
  const onEdit = (label: string, recipe: Recipe) => st.editDoc(p.b.id, label, recipe);
  const storey = p.b.doc.storeys.find((s) => s.id === p.storeyId);
  // Film strip EUIs are their own little evidence (the EUI after each version).
  const nodes = useMemo<EvidenceNode[]>(
    () =>
      p.b.versions
        .filter((v) => v.euiMid !== undefined)
        .map((v) => ({
          id: `ev_film.${v.id}`,
          quantity: 'eui.site',
          subject: { homeId: p.b.id, buildingId: p.b.id, mode: 'standard' },
          value: { float: v.euiMid as number },
          unit: 'kWh/m2.yr',
          formula: { id: 'PREVIEW', doc: 'EUI after this version' },
          inputs: [],
          provenance: { kind: 'preview' },
          seal: 'preview',
          rounding: { mode: 'sig', value: 2 },
        })),
    [p.b.versions, p.b.id],
  );
  const filmSrc = useMemo(() => {
    const m = new Map(nodes.map((n) => [n.id, n]));
    return { node: (id: `ev_${string}`) => m.get(id), locale: 'en-IN' };
  }, [nodes]);

  return (
    <div className="st-stack">
      <Card title="Storeys" kicker="Make">
        <StoreyStack
          doc={p.b.doc}
          storeyId={p.storeyId}
          onStorey={p.onStorey}
          onEdit={onEdit}
          limited={p.limited}
        />
      </Card>
      <Card title="Properties">
        <Inspector
          doc={p.b.doc}
          storeyId={p.storeyId}
          selection={p.selection}
          segId={p.segId}
          onEdit={onEdit}
          limited={p.limited}
          onSegment={(seg) => p.onSelect(p.selection, seg)}
        />
        <PlanOutline
          doc={p.b.doc}
          storeyId={p.storeyId}
          selection={p.selection}
          onStorey={p.onStorey}
          onSelect={(ids) => p.onSelect(ids)}
        />
      </Card>
      {p.limited ? null : (
        <Card title="Trace a plan" kicker="Underlay">
          <p className="st-note">
            Put a drawing under {storey?.name ?? 'this storey'} and trace rooms over it. Images work now; PDF
            pages arrive with the PDF reader.
          </p>
          <label className="ib-btn ib-btn--quiet st-file">
            Choose an image
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                p.onUnderlay(p.storeyId, URL.createObjectURL(f));
                onEdit(
                  'Add underlay',
                  setUnderlay(p.storeyId, {
                    ref: f.name,
                    page: 1,
                    opacityPm: 450,
                    calibration: { a: [0, 0], b: [1000, 0], distance: 165_000 },
                  }),
                );
              }}
            />
          </label>
          {storey?.underlay ? (
            <div className="st-underlay">
              <span className="st-field">
                <span>Drawing width (calibrate)</span>
                <Stepper
                  id={`uw-${p.storeyId}`}
                  label="drawing width in metres"
                  value={(storey.underlay.calibration?.distance ?? 165_000) / 1000}
                  min={1}
                  max={2000}
                  step={0.5}
                  decimals={1}
                  onChange={(m) => {
                    const u = storey.underlay;
                    if (u && m > 0)
                      onEdit(
                        'Scale underlay',
                        setUnderlay(p.storeyId, {
                          ...u,
                          calibration: { a: [0, 0], b: [1000, 0], distance: Math.round(m * 1000) },
                        }),
                      );
                  }}
                />
              </span>
              <Range
                label="Opacity"
                value={Math.round(storey.underlay.opacityPm / 10)}
                min={10}
                max={90}
                step={5}
                format={(v) => `${v}%`}
                onChange={(v) => {
                  const u = storey.underlay;
                  if (u) onEdit('Underlay opacity', setUnderlay(p.storeyId, { ...u, opacityPm: v * 10 }));
                }}
              />
              <button
                type="button"
                className="ib-link"
                onClick={() => {
                  p.onUnderlay(p.storeyId, undefined);
                  onEdit('Remove underlay', setUnderlay(p.storeyId, undefined));
                }}
              >
                Remove
              </button>
            </div>
          ) : null}
        </Card>
      )}
      <EvidenceProvider source={filmSrc}>
        <FilmStrip
          title="Versions (undo is a scroll)"
          frames={p.b.versions.map((v) => ({
            id: v.id,
            label: v.label,
            when: agoWords(v.at),
            thumb: <DocThumb doc={v.doc} />,
            origin: v.origin,
            ...(v.euiMid !== undefined ? { eui: `ev_film.${v.id}` as const } : {}),
          }))}
          current={p.b.versions[p.b.versions.length - 1]?.id}
          onPick={(id) => st.restoreVersion(p.b.id, id)}
        />
      </EvidenceProvider>
      <button
        type="button"
        className="ib-btn ib-btn--quiet"
        onClick={() => st.saveVersion(p.b.id, 'Named version')}
      >
        Save this version
      </button>
    </div>
  );
}
