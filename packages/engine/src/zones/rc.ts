/**
 * 5R1C zone model, ISO 13790:2008 simple hourly method (Annex C), the network ISO 52016-1 keeps
 * for its simplified route. Crank-Nicolson step of C.3, one hour; ideal heating and cooling to set
 * points with the 10 W/m² probe of C.4 (unlimited capacity, the plant model meets the load).
 */

export interface RcZone {
  /** Conditioned floor area, m². */
  af: number;
  /** Window and door conductance, W/K. */
  htrW: number;
  /** Opaque envelope conductance, W/K (walls and roof to outdoors). */
  htrOp: number;
  /** Internal heat capacity, J/K (medium construction: 165 kJ/m²K x Af). */
  cmJ: number;
}

export interface RcHourly {
  /** Outdoor dry bulb, degC. */
  te: Float64Array;
  /** Ventilation and infiltration conductance, W/K, per hour. */
  hve: Float64Array;
  /** Internal gains, W. */
  phiInt: Float64Array;
  /** Solar gains, W. */
  phiSol: Float64Array;
  /** Set points per hour; NaN means free floating that hour. */
  heatSet: Float64Array;
  coolSet: Float64Array;
}

export interface RcResult {
  /** Air temperature, degC. */
  air: Float64Array;
  /** Free-floating air temperature the same hour (before any heating or cooling), degC. */
  free: Float64Array;
  /** Sensible heating (positive) and cooling (positive) delivered, W. */
  heat: Float64Array;
  cool: Float64Array;
}

/** Simulate one zone over the hours; the first pass warms the mass and is discarded. */
export function simulateRc(z: RcZone, x: RcHourly, warmupHours = 720): RcResult {
  const n = x.te.length;
  const am = 2.5 * z.af;
  const at = 4.5 * z.af;
  const htrMs = 9.1 * am;
  const htrIs = 3.45 * at;
  const htrEm = z.htrOp > 0 ? 1 / (1 / z.htrOp - 1 / htrMs) : 0;
  const cm = z.cmJ / 3600;
  const air = new Float64Array(n);
  const free = new Float64Array(n);
  const heat = new Float64Array(n);
  const cool = new Float64Array(n);
  let thetaM = 24;
  const start = n - Math.min(warmupHours, n);
  for (let pass = 0; pass < 2; pass++) {
    const from = pass === 0 ? start : 0;
    for (let h = from; h < n; h++) {
      const te = x.te[h] as number;
      const hve = Math.max(1e-6, x.hve[h] as number);
      const h1 = 1 / (1 / hve + 1 / htrIs);
      const h2 = h1 + z.htrW;
      const h3 = 1 / (1 / h2 + 1 / htrMs);
      const pi = x.phiInt[h] as number;
      const ps = x.phiSol[h] as number;
      const phiIa = 0.5 * pi;
      const phiM = (am / at) * (0.5 * pi + ps);
      const phiSt = (1 - am / at - z.htrW / (9.1 * at)) * (0.5 * pi + ps);
      const solve = (phiHC: number) => {
        const phiMTot = phiM + htrEm * te + (h3 * (phiSt + z.htrW * te + h1 * ((phiIa + phiHC) / hve + te))) / h2;
        const mNew = (thetaM * (cm - 0.5 * (h3 + htrEm)) + phiMTot) / (cm + 0.5 * (h3 + htrEm));
        const mAvg = 0.5 * (mNew + thetaM);
        const s = (htrMs * mAvg + phiSt + z.htrW * te + h1 * (te + (phiIa + phiHC) / hve)) / (htrMs + z.htrW + h1);
        const a = (htrIs * s + hve * te + phiIa + phiHC) / (htrIs + hve);
        return { mNew, a };
      };
      let r = solve(0);
      const ff = r.a;
      let phi = 0;
      const hs = x.heatSet[h] as number;
      const cs = x.coolSet[h] as number;
      const target = !Number.isNaN(hs) && r.a < hs ? hs : !Number.isNaN(cs) && r.a > cs ? cs : Number.NaN;
      if (!Number.isNaN(target)) {
        const probe = 10 * z.af;
        const r10 = solve(probe);
        const slope = (r10.a - r.a) / probe;
        phi = slope > 0 ? (target - r.a) / slope : 0;
        r = solve(phi);
      }
      thetaM = r.mNew;
      if (pass === 1) {
        air[h] = r.a;
        free[h] = ff;
        if (phi > 0) heat[h] = phi;
        else cool[h] = -phi;
      }
    }
  }
  return { air, free, heat, cool };
}
