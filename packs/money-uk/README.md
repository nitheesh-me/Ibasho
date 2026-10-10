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
| `cost-loft-270`, `cost-loft-300`, `cost-draught-proofing-chimney-balloon`, `cost-heat-ashp`, `cost-heat-ashp-radiators-plus` | measure-cost | BP 6.1 cost models scaled by the twin; cylinder added when a heat pump replaces a combi; 0% VAT on energy-saving materials to 31 March 2027, then 20% | secondary or estimate |
| `grant-bus` | grant | Boiler Upgrade Scheme, 7,500 pounds, England and Wales, owners and landlords (SF 6) | secondary |
| `value-uk-oo-v1` | value-evidence | SF 4.2 owner-occupier index; exact rational uplift | secondary |

Helpers: `slabCharge`, `slabBill`, `checkSlabTable`, `flatTariff`, `pencePerKwhToMicroPencePerWh`, `esmVatRate`, `heatPumpSizeKw`.

## Status

M-0 slice done; tests in `test/money-uk.test.ts`.

PLACEHOLDER until M-B: costs for the other SPEC 9 options, the cylinder and hob sub-measures and the two assessments; the heat pump size comes from a cost-side estimate until WP-01's `hp.size_kw` is available to cost plugins; SEG export; DESNZ your-home factors with T&D; the Green Book trajectory; WH:LG, Halifax reward, loan stub, ECO4 and GBIS shown closed; `epc-proxy/rating`. Cost ranges are an estimate spread (80% to 130% of the central value).

Commands: `pnpm --filter @ibasho/pack-money-uk typecheck`, `pnpm --filter @ibasho/pack-money-uk test`.
