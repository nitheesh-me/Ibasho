/**
 * Dev harness for `@ibasho/scene` (WP-07): the GH1 terrace on the stage with every T1 control.
 * Not shipped. URL parameters drive Playwright captures:
 *   ?style=washi|yoru|svg&layers=heat-flow,thermal-lens,zone-tint&view=cutaway|exterior
 *   &az=45&reduced=1&outline=1&pencil=1&tier=0..3&lift=1&assets=0&chrome=0&capture=1
 */
import type { HomeTwin, QualityTier } from '@ibasho/core';
import '@ibasho/ui/andon.css';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import gh1 from '../../fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import {
  loadAssets,
  ROOF_LIFT,
  type SceneAssets,
  Stage,
  type StageStyle,
  type StillStats,
  type ViewKind,
  withFixtureJunctions,
} from '../src/index.ts';

const q = new URLSearchParams(location.search);
const twin = withFixtureJunctions(gh1 as unknown as HomeTwin);
const ALL_LAYERS = ['heat-flow', 'thermal-lens', 'zone-tint'] as const;

function App() {
  const [style, setStyle] = useState<StageStyle>((q.get('style') as StageStyle) ?? 'washi');
  const [layers, setLayers] = useState<string[]>(q.get('layers')?.split(',').filter(Boolean) ?? []);
  const [view, setView] = useState<ViewKind>((q.get('view') as ViewKind) ?? 'cutaway');
  const [az, setAz] = useState(Number(q.get('az') ?? 45));
  // Capture mode (dev/capture.mjs): reduced motion, so no overlay ticker keeps SwiftShader busy.
  const capture = q.get('capture') === '1';
  const [reduced, setReduced] = useState(q.get('reduced') === '1' || (capture && q.get('lift') !== '1'));
  const [outline, setOutline] = useState(q.get('outline') === '1');
  const [pencil, setPencil] = useState(q.get('pencil') === '1');
  const [tier, setTier] = useState<QualityTier>(Number(q.get('tier') ?? 3) as QualityTier);
  const [llm, setLlm] = useState(false);
  const [seqKey, setSeqKey] = useState<number | undefined>(q.get('lift') === '1' ? 1 : undefined);
  const [assets, setAssets] = useState<SceneAssets | null>(null);
  const stats = useRef<StillStats | null>(null);
  const [shown, setShown] = useState('');
  const chrome = q.get('chrome') !== '0';

  useEffect(() => {
    if (q.get('assets') === '0') return;
    loadAssets('/assets/').then(setAssets);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = style === 'yoru' ? 'yoru' : 'hiru';
  }, [style]);

  useEffect(() => {
    const id = setInterval(() => {
      const s = stats.current;
      const line = s
        ? `${s.phase} · renders ${s.sceneRenders} · composites ${s.composites} · calls ${s.lastCalls} · tris ${s.lastTriangles} · bake ${s.bakeCalls}/${s.bakeTriangles}`
        : 'svg';
      setShown(line);
      (window as unknown as { __sceneStats?: StillStats | null }).__sceneStats = s ? { ...s } : null;
    }, 250);
    return () => clearInterval(id);
  }, []);

  const toggle = (id: string): void =>
    setLayers((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: chrome ? 'auto 1fr auto' : '1fr',
        height: '100vh',
        background: 'var(--bg)',
      }}
    >
      {chrome ? (
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            padding: '8px 16px',
            font: '13px/1.4 var(--font-sans, system-ui)',
            color: 'var(--text)',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <strong>Scene harness · GH1</strong>
          {(['washi', 'yoru', 'svg'] as const).map((s) => (
            <label key={s}>
              <input type="radio" name="style" checked={style === s} onChange={() => setStyle(s)} /> {s}
            </label>
          ))}
          <span>|</span>
          {ALL_LAYERS.map((l) => (
            <label key={l}>
              <input type="checkbox" checked={layers.includes(l)} onChange={() => toggle(l)} /> {l}
            </label>
          ))}
          <span>|</span>
          <select value={view} onChange={(e) => setView(e.target.value as ViewKind)} aria-label="View">
            <option value="cutaway">cutaway</option>
            <option value="exterior">exterior</option>
          </select>
          <button type="button" onClick={() => setAz((a) => a - 45)}>
            turn left
          </button>
          <button type="button" onClick={() => setAz((a) => a + 45)}>
            turn right
          </button>
          <button type="button" onClick={() => setSeqKey((k) => (k ?? 0) + 1)}>
            roof lift
          </button>
          <label>
            <input type="checkbox" checked={reduced} onChange={() => setReduced((r) => !r)} /> reduced motion
          </label>
          <label>
            <input type="checkbox" checked={outline} onChange={() => setOutline((r) => !r)} /> outline
          </label>
          <label>
            <input type="checkbox" checked={pencil} onChange={() => setPencil((r) => !r)} /> pencil
          </label>
          <label>
            <input type="checkbox" checked={llm} onChange={() => setLlm((r) => !r)} /> LLM busy
          </label>
          <select
            value={tier}
            onChange={(e) => setTier(Number(e.target.value) as QualityTier)}
            aria-label="Tier cap"
          >
            {[3, 2, 1, 0].map((t) => (
              <option key={t} value={t}>
                tier {t}
              </option>
            ))}
          </select>
          <code style={{ opacity: 0.7 }} data-testid="stats">
            {shown}
          </code>
        </header>
      ) : null}
      <main style={{ position: 'relative', minHeight: 0 }}>
        <Stage
          twin={twin}
          style={style}
          layers={layers}
          view={view}
          azimuthDeg={az}
          onAzimuthChange={setAz}
          reducedMotion={reduced}
          showOutline={outline}
          pencil={pencil}
          tierCap={tier}
          llmGenerating={llm}
          assets={assets}
          sequence={ROOF_LIFT}
          {...(seqKey !== undefined ? { sequenceKey: seqKey } : {})}
          stats={stats}
        />
      </main>
    </div>
  );
}

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
