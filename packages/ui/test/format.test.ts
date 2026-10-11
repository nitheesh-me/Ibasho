import { describe, expect, it } from 'vitest';
import {
  decFromNumber,
  decFromRatio,
  decFromString,
  decToString,
  roundSig,
  roundStep,
  roundToExp,
} from '../src/num/decimal.ts';
import { formatEvidence, MINUS } from '../src/num/format.ts';
import { node } from './helpers.ts';

const s = (x: string) => decFromString(x);

describe('exact decimals', () => {
  it('parse and print without going through a float', () => {
    expect(decToString(s('123456789012345678901234567890'))).toBe('123456789012345678901234567890');
    expect(decToString(s('-0.0050'))).toBe('-0.0050');
    expect(decToString(s('1.5e-7'))).toBe('0.00000015');
    expect(decToString(s('12e3'))).toBe('12000');
    expect(decToString(decFromNumber(0.1 + 0.2))).toBe('0.30000000000000004');
    expect(decToString(decFromRatio(1n, 3n, 4))).toBe('0.3333');
    expect(decToString(decFromRatio(-2n, 3n, 2))).toBe('-0.67');
    expect(() => decFromString('1,000')).toThrow();
    expect(() => decFromNumber(Number.NaN)).toThrow();
  });

  it('round half even to significant figures', () => {
    expect(decToString(roundSig(s('12345'), 2))).toBe('12000');
    expect(decToString(roundSig(s('0.012345'), 2))).toBe('0.012');
    expect(decToString(roundSig(s('2.5'), 1))).toBe('2');
    expect(decToString(roundSig(s('3.5'), 1))).toBe('4');
    expect(decToString(roundSig(s('-2.5'), 1))).toBe('-2');
    expect(decToString(roundSig(s('9996'), 3))).toBe('10000');
    expect(decToString(roundSig(s('2.50'), 3))).toBe('2.50');
    expect(decToString(roundSig(s('0'), 3))).toBe('0');
  });

  it('round half even to a step', () => {
    expect(decToString(roundStep(s('1250'), s('100')))).toBe('1200');
    expect(decToString(roundStep(s('1350'), s('100')))).toBe('1400');
    expect(decToString(roundStep(s('-1350'), s('100')))).toBe('-1400');
    expect(decToString(roundStep(s('7.26'), s('0.05')))).toBe('7.25');
    expect(decToString(roundStep(s('7.275'), s('0.05')))).toBe('7.30');
    expect(decToString(roundToExp(s('0.125'), -2))).toBe('0.12');
    expect(() => roundStep(s('1'), s('0'))).toThrow();
  });
});

describe('formatEvidence', () => {
  it('shows integer Wh as kWh, rounded in the node unit', () => {
    const f = formatEvidence(
      node('energy.saving', { fixed: '3104512', unit: 'Wh' }, 'Wh', { mode: 'step', value: 10_000 }),
    );
    expect(f.text).toBe('3,100 kWh');
    expect(f.parts.map((p) => p.kind)).toEqual(['digits', 'unit']);
    expect(f.spoken).toBe('3,100 kilowatt hours');
  });

  it('shows micro-pence a year as pounds a year, with a true minus', () => {
    const f = formatEvidence(
      node('money.bill_saving', { fixed: '-34012000000', unit: 'micro-pence/yr' }, 'micro-pence/yr', {
        mode: 'step',
        value: 1e9,
      }),
    );
    expect(f.text).toBe(`${MINUS}£340 a year`);
    expect(f.parts.map((p) => p.kind)).toEqual(['sign', 'prefix', 'digits', 'unit']);
    expect(f.spoken).toBe('minus 340 pounds a year');
    expect(f.sign).toBe(-1);
  });

  it('signs deltas when asked and never signs zero', () => {
    const up = node('energy.delta.elec', { fixed: '1412000', unit: 'Wh' }, 'Wh', { mode: 'sig', value: 2 });
    expect(formatEvidence(up, { signed: true }).text).toBe('+1,400 kWh');
    expect(formatEvidence(up).text).toBe('1,400 kWh');
    const zero = node('z', { fixed: '4', unit: 'Wh' }, 'Wh', { mode: 'step', value: 1000 });
    expect(formatEvidence(zero, { signed: true }).text).toBe('0 kWh');
  });

  it('keeps fraction digits that the rounding policy implies', () => {
    const u = node('fabric.u.wall', { float: 2.1049 }, 'W/m2K', { mode: 'sig', value: 2 }, 'modelled');
    expect(formatEvidence(u).text).toBe('2.1 W/m²K');
    const t = node('heat.theta', { float: 4 }, 'degC', { mode: 'step', value: 0.1 }, 'modelled');
    expect(formatEvidence(t).text).toBe('4.0 °C');
  });

  it('formats ranges with "to", never a dash', () => {
    const r = node(
      'uncert.bill',
      { interval: { lo: 1187, hi: 1642 } },
      'kWh',
      { mode: 'sig', value: 2 },
      'modelled',
    );
    const f = formatEvidence(r);
    expect(f.text).toBe('1,200 to 1,600 kWh');
    expect(f.text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}-]`));
  });

  it('formats exact rationals (score) and categories', () => {
    expect(
      formatEvidence(node('score.total', { exact: { n: 1367n, d: 20n } }, 'pts', { mode: 'step', value: 1 }))
        .text,
    ).toBe('68');
    expect(
      formatEvidence(node('epc.band_est', { cat: 'D' }, 'band', { mode: 'step', value: 1 }, 'modelled')).text,
    ).toBe('D');
    expect(formatEvidence(node('fin.cash', { cat: 'true' }, 'bool', { mode: 'step', value: 1 })).text).toBe(
      'Yes',
    );
  });

  it('switches display unit with `as` and rejects unrelated ones', () => {
    const c = node('acct.carbon_saving', { fixed: '2345678', unit: 'gCO2e' }, 'gCO2e', {
      mode: 'sig',
      value: 2,
    });
    expect(formatEvidence(c).text).toBe('2,300 kg CO₂e');
    expect(formatEvidence(c, { as: 'tCO2e' }).text).toBe('2.3 t CO₂e');
    const e = node('e', { fixed: '12500', unit: 'kWh' }, 'kWh', { mode: 'sig', value: 3 });
    expect(formatEvidence(e, { as: 'MWh' }).text).toBe('12.5 MWh');
    expect(() => formatEvidence(e, { as: 'tCO2e' })).toThrow();
  });

  it('respects the locale grouping (en-IN lakh)', () => {
    const r = node('money.inr', { fixed: '123456700000000', unit: 'micro-paise' }, 'micro-paise', {
      mode: 'step',
      value: 1e8,
    });
    expect(formatEvidence(r, { locale: 'en-IN' }).text).toBe('₹12,34,567');
  });

  it('puts percent tight against the number', () => {
    expect(
      formatEvidence(node('fin.irr', { float: 7.25 }, '%', { mode: 'step', value: 0.1 }, 'modelled')).text,
    ).toBe('7.2%');
  });
});

describe('ranges that round to one value', () => {
  it('read as one number', async () => {
    const { formatEvidence } = await import('../src/num/format.ts');
    const { node } = await import('./helpers.ts');
    const f = formatEvidence(
      node('r', { interval: { lo: 1101, hi: 1099 } }, 'kWh', { mode: 'sig', value: 2 }),
      { locale: 'en-GB' },
    );
    expect(f.text).toBe('1,100 kWh');
  });
});
