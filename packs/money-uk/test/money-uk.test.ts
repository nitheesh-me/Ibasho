/**
 * money-uk golden tests (WP-02, M-0). Tests may wire packs and fixtures (dependency-cruiser exempts
 * tests).
 */
import { BANDS, createRegistry, type HomeTwin, MONTHS, type OwnerCtx, Q, type SlabTable } from '@ibasho/core';
import { parseTwin } from '@ibasho/core/schemas';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import gh1Json from '../../../packages/fixtures/src/homes/gh1.twin.json' with { type: 'json' };
import homeUkEngineModule from '../../home-uk/src/engine/module.ts';
import {
  BUS_AMOUNT,
  carbonSap102,
  carbonTrajectoryFlat,
  costAshp,
  costAshpRadiatorsPlus,
  costDraught,
  costLoft270,
  costLoft300,
  esmVatRate,
  grantBus,
  heatPumpSizeKw,
  moneyUkEngineModule,
  pencePerKwhToMicroPencePerWh,
  slabBill,
  slabCharge,
  TariffError,
  ukCapElectricity2026q4,
  ukCapGas2026q4,
  VALUE_TABLE_V1,
  valueUkOwnerOccupierV1,
} from '../src/engine/index.ts';

const gh1: HomeTwin = parseTwin(gh1Json);
const POUND = 100_000_000n;
const owner: OwnerCtx = { tenure: 'owner', discountRatePpb: 35_000_000n, horizonYears: 25 };
const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

describe('module', () => {
  it('registers with home-uk: every M-0 option now has a measure-cost (ARCH 4.1 measure ids)', async () => {
    const reg = createRegistry();
    reg.registerAll([...(await homeUkEngineModule.load()), ...(await moneyUkEngineModule.load())]);
    expect(
      reg
        .all('measure-cost')
        .map((c) => c.optionId)
        .sort(),
    ).toEqual([
      'draught-proofing-chimney-balloon',
      'heat-ashp',
      'heat-ashp-radiators-plus',
      'loft-270',
      'loft-300',
    ]);
    expect(reg.all('tariff', { region: 'GB-ENG', asOf: '2026-10-11' })).toHaveLength(2);
    expect(reg.all('tariff', { region: 'GB-ENG', asOf: '2027-01-01' })).toHaveLength(0);
  });
});

describe('slab tariffs (money.bill, slab exact)', () => {
  const twoSlab: SlabTable = {
    period: 'month',
    slabs: [
      { uptoWh: 100_000n, price: 5_100n },
      { uptoWh: null, price: 7_700n },
    ],
    standingPerDay: 0n,
  };

  it('prices convert exactly: 26.32 p/kWh is 26,320 micro-pence per Wh', () => {
    expect(pencePerKwhToMicroPencePerWh('26.32')).toBe(26_320n);
    expect(pencePerKwhToMicroPencePerWh('7.97')).toBe(7_970n);
    expect(() => pencePerKwhToMicroPencePerWh('7.9701')).toThrow(TariffError);
  });

  it('telescopic slabs charge each slab only for the energy inside it', () => {
    expect(slabCharge(50_000n, twoSlab.slabs)).toBe(50_000n * 5_100n);
    expect(slabCharge(150_000n, twoSlab.slabs)).toBe(100_000n * 5_100n + 50_000n * 7_700n);
  });

  it('a slab bill is monotone and its marginal price is the slab price (Lean slab_bill_monotone)', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10_000_000n }), fc.bigInt({ min: 0n, max: 1_000n }), (a, d) => {
        const x = slabCharge(a, twoSlab.slabs);
        const y = slabCharge(a + d, twoSlab.slabs);
        expect(y >= x).toBe(true);
        expect(y - x <= d * 7_700n && y - x >= d * 5_100n).toBe(true);
      }),
    );
  });

  it('yearly slabs bill cumulative use; months sum to the annual charge', () => {
    const yearly: SlabTable = { ...twoSlab, period: 'year' };
    const wh = MONTHS.map(() => 20_000n);
    const b = slabBill(wh, days, yearly, true);
    expect(b.total).toBe(slabCharge(240_000n, yearly.slabs));
    expect(b.byMonth.reduce((s, x) => s + x, 0n)).toBe(b.total);
  });

  it('Ofgem cap Q4 2026: unit rate plus standing charge; gas disconnect drops the gas standing charge', () => {
    const gas = MONTHS.map(() => 1_000_000n); // 1,000 kWh a month
    expect(ukCapGas2026q4.bill(gas, { days }).total).toBe(12_000_000n * 7_970n + 365n * 29_680_000n);
    const none = MONTHS.map(() => 0n);
    expect(ukCapGas2026q4.bill(none, { days }).total).toBe(0n);
    expect(ukCapElectricity2026q4.bill(none, { days }).total).toBe(365n * 54_830_000n);
  });
});

describe('carbon (R6)', () => {
  it('SAP 10.2 monthly electricity and gas, micro-grams per Wh', () => {
    expect(carbonSap102.factor('electricity', 0)).toBe(163_000n);
    expect(carbonSap102.factor('electricity', 6)).toBe(111_000n);
    expect(carbonSap102.factor('gas', 3)).toBe(210_000n);
  });
  it('a fuel with no sourced factor throws instead of counting as zero', () => {
    expect(() => carbonSap102.factor('biomass', 0)).toThrow(/no factor/);
    expect(() => carbonTrajectoryFlat.factor('district', 2030)).toThrow(/no factor/);
  });
});

describe('measure costs (BP 6.1) on GH1', () => {
  const asOf = '2026-10-11' as const;
  it('loft 300: 300 + 10 per m2 of a 42 m2 loft = 720 pounds at 0% VAT', () => {
    const c = costLoft300.cost(gh1, asOf);
    expect(c.mid).toBe(720n * POUND);
    expect(c.lo).toBeLessThan(c.mid);
    expect(c.hi).toBeGreaterThan(c.mid);
    expect(Q.isZero(c.vatRate)).toBe(true);
    expect(costLoft270.cost(gh1, asOf).mid).toBe(678n * POUND);
  });
  it('draught-proofing: 150 + 15 x 6 openings + 50 x 1 chimney = 290 pounds', () => {
    expect(costDraught.cost(gh1, asOf).mid).toBe(290n * POUND);
  });
  it('ASHP: 6,500 + 700 per kW plus a cylinder because GH1 has a combi', () => {
    const kw = heatPumpSizeKw(gh1);
    expect(kw).toBeGreaterThanOrEqual(4);
    expect(kw).toBeLessThanOrEqual(16);
    expect(costAshp.cost(gh1, asOf).mid).toBe((6_500n + 700n * BigInt(kw) + 1_600n) * POUND);
    const cyl = {
      ...gh1,
      systems: { ...gh1.systems, dhw: { ...gh1.systems.dhw, class: 'cylinder' as const } },
    };
    expect(costAshp.cost(cyl, asOf).mid).toBe((6_500n + 700n * BigInt(kw)) * POUND);
    expect(costAshpRadiatorsPlus.cost(gh1, asOf).mid).toBeGreaterThan(costAshp.cost(gh1, asOf).mid);
  });
  it('0% VAT on energy-saving materials ends 31 March 2027, then 20% applies (validTo)', () => {
    expect(Q.isZero(esmVatRate('2027-03-31'))).toBe(true);
    expect(esmVatRate('2027-04-01')).toEqual(Q.of(1, 5));
    expect(costLoft300.cost(gh1, '2027-04-01').mid).toBe(864n * POUND);
  });
});

describe('BUS grant (SF 6)', () => {
  const ashp = { id: 'heat-ashp', options: { heat: 'heat-ashp' } };
  const loft = { id: 'loft-300', options: { loft: 'loft-300' } };
  it('7,500 pounds for an ASHP in England for an owner', () => {
    expect(grantBus.eligible(gh1, owner, ashp, '2026-10-11')?.amount).toBe(BUS_AMOUNT);
    expect(BUS_AMOUNT).toBe(7_500n * POUND);
  });
  it('nothing without a heat pump, for a tenant, outside England and Wales, or after validTo', () => {
    expect(grantBus.eligible(gh1, owner, loft, '2026-10-11')).toBeNull();
    expect(grantBus.eligible(gh1, { ...owner, tenure: 'tenant' }, ashp, '2026-10-11')).toBeNull();
    expect(grantBus.eligible({ ...gh1, region: 'GB-SCT' }, owner, ashp, '2026-10-11')).toBeNull();
    expect(grantBus.eligible(gh1, owner, ashp, '2028-04-01')).toBeNull();
  });
});

describe('value evidence v1 (SF 4.2, R16, AC-9)', () => {
  it('F to C on 280,000 pounds: about 4k low, 11.5k central, 49k high (SF 4.2 example)', () => {
    const u = valueUkOwnerOccupierV1.uplift('F', 'C')!;
    const at = (q: Q) => Q.roundHalfEven(Q.mul(q, Q.of(280_000)));
    expect(at(u.low)).toBe(3_976n);
    expect(at(u.central)).toBe(11_546n);
    expect(at(u.high)).toBe(49_318n);
  });
  it('low <= central <= high for every upward move; no effect inside one row', () => {
    for (const [i, a] of BANDS.entries()) {
      for (const b of BANDS.slice(0, i)) {
        const u = valueUkOwnerOccupierV1.uplift(a, b);
        if (u === null) {
          expect(a === 'B' && b === 'A').toBe(true);
          continue;
        }
        expect(Q.le(u.low, u.central) && Q.le(u.central, u.high)).toBe(true);
      }
    }
    expect(Object.keys(VALUE_TABLE_V1)).toHaveLength(6);
  });
});
