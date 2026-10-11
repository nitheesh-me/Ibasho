/**
 * Evidence nodes for the Homes screens. Owner: WP-08.
 *
 * Every figure on a Homes screen is a `Num` over one of these nodes: provenance `computed`, grade
 * `estimate`, seal `modelled` (the score and savings come from the documented model in
 * `model.ts`, not from measurement and not from the narrator).
 */
import type { EvidenceId, EvidenceNode, EvidenceValue, Unit } from '@ibasho/core';
import type { Analysis } from './model.ts';

export interface HomeEv {
  score: EvidenceId;
  potential?: EvidenceId;
  sub: Record<string, EvidenceId>;
  weight: Record<string, EvidenceId>;
  contribution: Record<string, EvidenceId>;
  elec: Record<string, EvidenceId>;
  gas: Record<string, EvidenceId>;
  pkgElec?: EvidenceId;
  pkgGas?: EvidenceId;
  pkgTotal?: EvidenceId;
  carbon?: EvidenceId;
  value?: EvidenceId;
  valueNow: EvidenceId;
  uplift?: EvidenceId;
  scoreAfter?: EvidenceId;
  baseElec?: EvidenceId;
  baseGas?: EvidenceId;
}

export function homeEvidence(a: Analysis, nodes: EvidenceNode[]): HomeEv {
  const key = a.home.id;
  const add = (
    q: string,
    value: EvidenceValue,
    unit: Unit,
    rounding: EvidenceNode['rounding'],
    doc: string,
  ): EvidenceId => {
    const id: EvidenceId = `ev_home.${key}.${q}`;
    nodes.push({
      id,
      quantity: q,
      subject: { homeId: key, mode: 'your-home' },
      value,
      unit,
      formula: { id: 'HOMES', doc },
      inputs: [],
      provenance: { kind: 'computed', grade: 'estimate' },
      seal: 'modelled',
      rounding,
    });
    return id;
  };
  const step = (v: number) => ({ mode: 'step' as const, value: v });
  const ev: HomeEv = {
    score: add(
      'score.total',
      { float: a.score.score },
      '1',
      step(1),
      'Weighted sum of seven sub-scores, rounded',
    ),
    sub: {},
    weight: {},
    contribution: {},
    elec: {},
    gas: {},
    valueNow: add(
      'value.now',
      { float: a.home.valueGbp },
      'GBP',
      step(1000),
      'Current value estimate (baseline)',
    ),
  };
  for (const c of a.score.components) {
    ev.sub[c.id] = add(`score.sub.${c.id}`, { float: c.sub }, '1', step(1), c.basis);
    ev.weight[c.id] = add(
      `score.weight.${c.id}`,
      { float: c.weight * 100 },
      '%',
      step(1),
      'Fixed weight from the brief',
    );
    ev.contribution[c.id] = add(
      `score.contribution.${c.id}`,
      { float: c.contribution },
      '1',
      step(0.1),
      'Weight times sub-score',
    );
  }
  if (a.home.elecKwh !== null)
    ev.baseElec = add(
      'energy.elec',
      { float: a.home.elecKwh },
      'kWh/yr',
      step(10),
      'Annualised from metered months',
    );
  if (a.home.gasKwh !== null)
    ev.baseGas = add(
      'energy.gas',
      { float: a.home.gasKwh },
      'kWh/yr',
      step(10),
      'Annualised from metered months',
    );
  for (const r of a.feasible) {
    if (Number.isFinite(r.elecSaving))
      ev.elec[r.id] = add(
        `saving.elec.${r.id}`,
        { float: r.elecSaving },
        'kWh/yr',
        step(10),
        'Saving after the retrofits above it; negative is an increase',
      );
    if (Number.isFinite(r.gasSaving))
      ev.gas[r.id] = add(
        `saving.gas.${r.id}`,
        { float: r.gasSaving },
        'kWh/yr',
        step(10),
        'Saving after the retrofits above it; negative is an increase',
      );
  }
  if (a.package) {
    ev.pkgElec = add(
      'saving.elec.package',
      { float: a.package.elecSaving },
      'kWh/yr',
      step(10),
      'Package, with interactions',
    );
    ev.pkgGas = add(
      'saving.gas.package',
      { float: a.package.gasSaving },
      'kWh/yr',
      step(10),
      'Package, with interactions',
    );
    ev.pkgTotal = add(
      'saving.total.package',
      { float: a.package.total },
      'kWh/yr',
      step(10),
      'Electricity plus gas',
    );
    if (a.package.potentialPct !== null)
      ev.potential = add(
        'potential',
        { float: a.package.potentialPct },
        '%',
        step(0.1),
        '100 x (baseline minus after) / baseline purchased energy',
      );
  }
  if (a.carbonKg !== null)
    ev.carbon = add(
      'carbon.saved',
      { float: a.carbonKg },
      'kgCO2e',
      { mode: 'sig', value: 2 },
      'Sum over fuels of change times factor (DESNZ 2024)',
    );
  if (a.value) {
    ev.value = add(
      'value.after',
      { interval: { lo: a.value.lo, hi: a.value.hi } },
      'GBP',
      step(500),
      'Indicative range from rating bands gained',
    );
    ev.uplift = add(
      'value.uplift',
      { interval: { lo: a.value.pctLo, hi: a.value.pctHi } },
      '%',
      step(0.5),
      'Indicative uplift range',
    );
  }
  if (a.scoreAfter)
    ev.scoreAfter = add(
      'score.after',
      { float: a.scoreAfter.score },
      '1',
      step(1),
      'Score with the chosen retrofits',
    );
  return ev;
}
