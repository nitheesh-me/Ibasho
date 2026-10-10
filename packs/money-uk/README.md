# @ibasho/pack-money-uk

Tariffs, carbon, trajectory, grants, value evidence and measure costs for the UK.

- **Owner:** WP-02. Skeleton created by WP-00 at G0.
- **Layer:** engine half L1 (L0 only, no react/three/DOM, no `Math.*` beyond exact operations). See ARCHITECTURE 3 and `.dependency-cruiser.cjs`.

## Public API

`./engine` exports `moneyUkEngineModule` (the `IbashoModule`, default export of `src/engine/module.ts`) and the plugins:

| Plugin | Kind | Data | Grade |
|---|---|---|---|
| `uk-cap-2026q4-electricity`, `uk-cap-2026q4-gas` | tariff | Ofgem cap 1 Oct to 31 Dec 2026: 26.32 p/kWh and 54.83 p/day; 7.97 p/kWh and 29.68 p/day, no gas standing charge once gas is unused (BP 7.1) | secondary |
| `carbon-sap10-2` | carbon | SAP 10.2 Table 12d monthly electricity, Table 12 gas, oil, LPG; integer µg/Wh; no biomass or district factor (throws) | secondary |
| `carbon-trajectory-flat-sap10-2` | carbon-trajectory | PLACEHOLDER: SAP 10.2 annual factors every year | estimate |
| `cost-<optionId>` for every SPEC 9 option (loft, walls, floor, draught, glazing, controls, MVHR, ASHP, PV, battery, solar thermal, cylinder jacket and new cylinder, induction hob, moisture and PAS 2035 assessments) | measure-cost | BP 6.1 cost models scaled by the twin; cylinder added when a heat pump replaces a combi; 0% VAT on energy-saving materials to 31 March 2027, then 20% | secondary or estimate |
| `cost-gas-combi-condensing` | measure-cost | Like-for-like boiler keyed by system id: A_cf and do-nothing replacements | estimate |
| `finance-loan-stub` | finance | PLACEHOLDER loan: 0% APR, 120 months, up to 15,000 pounds | estimate |
| `epc-proxy/rating` | epc-proxy | RdSAP 10 Table 32 prices, SAP 10.2 cost rating; `sapFor(run, tfaM2)` (core `sap` lacks the floor area) | estimate |
| `grant-bus` | grant | Boiler Upgrade Scheme, 7,500 pounds, England and Wales, owners and landlords (SF 6) | secondary |
| `value-uk-oo-v1` | value-evidence | SF 4.2 owner-occupier index; exact rational uplift | secondary |

Helpers: `slabCharge`, `slabBill`, `checkSlabTable`, `flatTariff`, `pencePerKwhToMicroPencePerWh`, `esmVatRate`, `heatPumpSizeKw`.

## Status

M-0 slice done; tests in `test/money-uk.test.ts`.

Done at M-B: costs for every SPEC 9 option, the like-for-like boiler, the loan stub, `epc-proxy/rating`.

PLACEHOLDER: the heat pump size comes from a cost-side estimate until WP-01's `hp.size_kw` is available to cost plugins; SEG export; DESNZ your-home factors with T&D; the Green Book trajectory; WH:LG, Halifax reward, ECO4 and GBIS shown closed; the 0.36 SAP deflator is unverified (grade estimate). Cost ranges are an estimate spread (80% to 130% of the central value).

Commands: `pnpm --filter @ibasho/pack-money-uk typecheck`, `pnpm --filter @ibasho/pack-money-uk test`.
