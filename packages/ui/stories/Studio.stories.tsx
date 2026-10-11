import type { EvidenceNode, StageBarState } from '@ibasho/core';
import { STUDIO_STAGES } from '@ibasho/core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { EvidenceProvider, staticEvidence } from '../src/evidence/context.tsx';
import {
  AnalysisLegend,
  CompareGrid,
  EndUseBar,
  EuiGauge,
  FilmStrip,
  LedgerRow,
  ModeTabs,
  PreviewStamp,
  RatingLadder,
  ScaleLadder,
  type ScaleLevel,
  StageBar,
  Stepper,
  type StudioMode,
  TypeCards,
} from '../src/v3/index.ts';

/** Illustrative Preview nodes for the v3 kit stories (never results). */
const n = (id: string, value: EvidenceNode['value'], unit: EvidenceNode['unit'], sig = 2): EvidenceNode => ({
  id: `ev_${id}`,
  quantity: id,
  subject: { homeId: 'bd_vindhya', mode: 'standard' },
  value,
  unit,
  formula: { id: 'PREVIEW', doc: 'story' },
  inputs: [],
  provenance: { kind: 'preview' },
  seal: 'preview',
  rounding: { mode: 'sig', value: sig },
});
const src = staticEvidence(
  [
    n('eui', { interval: { lo: 128, hi: 171 } }, 'kWh/m2.yr'),
    n('target', { float: 140 }, 'kWh/m2.yr', 3),
    n('b5', { float: 90 }, 'kWh/m2.yr'),
    n('b3', { float: 130 }, 'kWh/m2.yr'),
    n('b1', { float: 175 }, 'kWh/m2.yr'),
    n('cool', { fixed: '1410000000', unit: 'Wh' }, 'Wh'),
    n('light', { fixed: '310000000', unit: 'Wh' }, 'Wh'),
    n('equip', { fixed: '820000000', unit: 'Wh' }, 'Wh'),
    n('fans', { fixed: '120000000', unit: 'Wh' }, 'Wh'),
    n('pv', { fixed: '-210000000', unit: 'Wh' }, 'Wh'),
    n('sav', { interval: { lo: 9, hi: 24 } }, '%'),
    n('irrlo', { float: 400 }, 'kWh/m2'),
    n('irrhi', { float: 1900 }, 'kWh/m2'),
  ],
  undefined,
  'en-IN',
);

function Studio() {
  const [level, setLevel] = useState<ScaleLevel>('building');
  const [mode, setMode] = useState<StudioMode>('look');
  const [tariff, setTariff] = useState(7.65);
  const bar: StageBarState = {
    jobId: 'story',
    generation: 1,
    stages: STUDIO_STAGES.map((id, i) => ({
      id,
      status: i < 2 ? 'done' : i === 2 ? 'running' : 'queued',
      fraction: i < 2 ? 1 : i === 2 ? 0.45 : 0,
      ...(i === 2 ? { tier: 'rough' as const } : {}),
      preview: true,
    })),
  };
  return (
    <EvidenceProvider source={src}>
      <div style={{ display: 'grid', gap: 24, maxWidth: 980 }}>
        <ModeTabs mode={mode} onChange={setMode} />
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 24 }}>
          <ScaleLadder level={level} onChange={setLevel} />
          <div style={{ display: 'grid', gap: 24 }}>
            <EuiGauge
              eui="ev_eui"
              target={{ ev: 'ev_target', label: 'ECSBC 2024 standard design' }}
              bands={[
                { label: 'Five star', ev: 'ev_b5' },
                { label: 'Three star', ev: 'ev_b3' },
                { label: 'One star', ev: 'ev_b1' },
              ]}
              scaleMax={260}
              preview
            />
            <EndUseBar
              preview
              rows={[
                { use: 'cooling', ev: 'ev_cool' },
                { use: 'lighting', ev: 'ev_light' },
                { use: 'equipment', ev: 'ev_equip' },
                { use: 'fans', ev: 'ev_fans' },
                { use: 'pv', ev: 'ev_pv' },
              ]}
            />
            <RatingLadder
              savings="ev_sav"
              axisMax={45}
              preview
              rows={[
                {
                  scheme: 'GHMC stars',
                  edition: '2026',
                  steps: [
                    'One star',
                    'Two stars',
                    'Three stars',
                    'Four stars',
                    'Five stars',
                    'Six stars',
                  ].map((level, i) => ({ level, atLeast: 5 * (i + 1) })),
                  applicability: 'adoption-unconfirmed',
                  estimate: true,
                },
                {
                  scheme: 'ECSBC tiers',
                  edition: '2024',
                  steps: [
                    { level: 'Base tier', atLeast: 0 },
                    { level: 'Plus', atLeast: 14 },
                    { level: 'Super', atLeast: 25 },
                  ],
                  applicability: 'not-a-certificate',
                },
                {
                  scheme: 'EDGE energy',
                  edition: 'v3',
                  steps: [
                    { level: 'EDGE', atLeast: 20 },
                    { level: 'Advanced', atLeast: 40 },
                  ],
                  applicability: 'not-a-certificate',
                },
              ]}
            />
            <AnalysisLegend
              ramp="hinata"
              unit="kWh/m² a year"
              min="ev_irrlo"
              max="ev_irrhi"
              resolution="standard"
              resolutionDetail="grid 1 m, 15 min steps"
              period="Typical year"
              method="Cumulative sky, Tregenza patches"
              tier="rough"
              preview
            />
            <LedgerRow
              label="Electricity energy charge"
              hint="HT commercial, per unit"
              unit="₹ per kWh"
              origin="default"
              source="TGSPDCL FY 2026-27"
              grade="estimate"
              scope="place"
              affects={37}
              control={(id) => (
                <Stepper
                  id={id}
                  label="tariff"
                  value={tariff}
                  step={0.05}
                  min={2}
                  max={20}
                  decimals={2}
                  onChange={setTariff}
                />
              )}
            />
            <CompareGrid
              slots={[
                { id: 'a', label: 'As it is', kicker: 'Current', body: <PreviewStamp /> },
                { id: 'b', label: 'Shaded and cool', kicker: 'What if', body: <PreviewStamp /> },
                { id: 'c', label: 'Least upfront', kicker: 'What if', body: <PreviewStamp /> },
              ]}
            />
            <FilmStrip
              frames={[
                { id: '1', label: 'Traced', thumb: <svg viewBox="0 0 10 6" /> },
                { id: '2', label: 'Chajjas on the west', thumb: <svg viewBox="0 0 10 6" /> },
              ]}
              current="2"
            />
          </div>
        </div>
        <TypeCards value="education" onChange={() => undefined} />
        <StageBar
          state={bar}
          message="Radiation: rough now, final in about 3 s"
          onCancel={() => undefined}
          cancelAfterMs={0}
        />
      </div>
    </EvidenceProvider>
  );
}

const meta: Meta<typeof Studio> = { title: 'Studio/Kit (v3)', component: Studio };
export default meta;
export const VindhyaPreview: StoryObj<typeof Studio> = {};
