// G0-3 fixture: no-math must report Math.exp (and the other non-exact uses below) here.
// Lives under packages/engine/ so the lint's path scope applies; excluded from normal runs.
export const decay = (t: number): number => Math.exp(-t);
export const fine = (a: number, b: number): number => Math.max(Math.abs(a), Math.floor(b));
export const square = (x: number): number => x ** 2;
export const allowed = (x: number): number => x ** 2; // lint-allow no-math: fixture for suppression
const M = Math;
export const viaAlias = (x: number): number => M.sqrt(x);
