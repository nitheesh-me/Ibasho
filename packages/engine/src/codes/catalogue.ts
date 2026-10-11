/**
 * What the real codes stage reads from the code and rating packs (WP-19). Structural shapes: the
 * packs (`@ibasho/pack-codes-in`, `-codes-global`, `-ratings`) export data that fits them, and the
 * engine never imports a pack directly; `createRealCodesProvider(catalogue, lib)` receives them.
 */
import type { CodeEdition, EnergyParams, Grade, RatingSchemePlugin, SourceRef } from '@ibasho/core';

export interface Limit<T = number> {
  value: T;
  clause: string;
  source: SourceRef;
  grade: Grade;
}
export type Tiers = readonly [number, number, number];

export interface CodesInData {
  scope: {
    connectedLoadKw: Limit;
    contractDemandKva: Limit;
    tsecbcBuaM2: Limit;
    mopBuaM2: Limit;
  };
  envelope: {
    wwrMax: Limit;
    roofU: Limit<Tiers>;
    roofU24h: Limit<Tiers>;
    wallU: Limit<Tiers>;
    windowU: Limit<Tiers>;
    shgcMax: Limit<Tiers>;
    shgcNorthMax: Limit;
    coolRoofReflectance: Limit;
  };
  lpd: Readonly<Record<string, Limit<Tiers>>>;
  daylightShare: Limit<Tiers>;
  renewableShare: Limit<Tiers>;
  epiRatio: Limit<Tiers>;
  standardDesign: EnergyParams;
  ens: {
    retvMax: Limit;
    coeff: Limit<{ a: number; b: number; c: number }>;
    omega: Limit<Readonly<Record<string, number>>>;
    roofU: Limit;
    wfrOp: Limit;
    openableShare: { lo: number; hi: number };
  };
  nbc: { openingRatio: Limit };
  ghmcStars: Limit<readonly number[]>;
}

export interface CodesUkData {
  notionalDwelling: Limit<EnergyParams>;
  notionalNonDom: Limit<EnergyParams>;
  limitingDwelling: Limit<{ wall: number; roof: number; window: number }>;
  limitingNonDom: Limit<{ wall: number; roof: number; window: number }>;
  fhsNotional: Limit<EnergyParams>;
  partO: Limit<{ high: { lo: number; hi: number }; moderate: { lo: number; hi: number } }>;
  londonPlan: {
    onSiteSaving: Limit;
    beLeanDwelling: Limit;
    beLeanNonDom: Limit;
    majorGiaM2: number;
    majorHomes: number;
  };
  carbon: Limit<{ electricity: number; gas: number }>;
}

export interface AppGData {
  envelope: { hot: Limit<EnergyParams>; mixed: Limit<EnergyParams> };
  lpd: Limit<Readonly<Record<string, number>>>;
  wwrCap: Limit;
  bpf: Limit<Readonly<Record<string, number>>>;
}

export interface CodesCatalogue {
  india: CodesInData;
  indiaEditions: readonly CodeEdition[];
  uk: CodesUkData;
  appG: AppGData;
  ratings: readonly RatingSchemePlugin[];
}
