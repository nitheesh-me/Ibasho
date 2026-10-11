/**
 * Type library lookups for the energy stage: space types by id (untyped rooms use office loads and
 * are counted so the EUI range widens, R33), schedules expanded to 8,760 hours with day types
 * (2026 calendar: 1 January is a Thursday) and the Indian academic vacation (May and June at 20%
 * for school and assembly schedules, BT brief).
 */
import type { SchedulePlugin, SpaceTypePlugin, TypeLibrary } from '@ibasho/core';
import { HOURS, monthOfHour } from './weather.ts';

export interface ResolvedSpace {
  space: SpaceTypePlugin;
  typed: boolean;
}

export function resolveSpace(lib: TypeLibrary, spaceTypeId: string | undefined): ResolvedSpace {
  const hit = spaceTypeId ? lib.spaceTypes.find((s) => s.spaceTypeId === spaceTypeId) : undefined;
  if (hit) return { space: hit, typed: true };
  const office = lib.spaceTypes.find((s) => s.spaceTypeId === 'office') ?? lib.spaceTypes[0];
  if (!office) throw new Error('type library has no space types');
  return { space: office, typed: false };
}

const cache = new WeakMap<SchedulePlugin, Float64Array>();
const FIRST_WEEKDAY = 3; // Thursday, 0 = Monday

/** A schedule as 8,760 hourly fractions (missing id: always 1, so loads are not lost silently). */
export function expandSchedule(lib: TypeLibrary, id: string | undefined): Float64Array {
  const s = id ? lib.schedules.find((x) => x.scheduleId === id) : undefined;
  if (!s) return new Float64Array(HOURS).fill(id === undefined ? 0 : 1);
  const hit = cache.get(s);
  if (hit) return hit;
  const term = /^(school|assembly)/.test(s.scheduleId);
  const out = new Float64Array(HOURS);
  for (let h = 0; h < HOURS; h++) {
    const dow = (Math.floor(h / 24) + FIRST_WEEKDAY) % 7;
    const dayType = dow < 5 ? s.profile.weekday : dow === 5 ? s.profile.saturday : s.profile.sunday;
    const m = monthOfHour(h);
    const vac = term && (m === 4 || m === 5) ? 0.2 : 1;
    out[h] = (dayType[h % 24] as number) * vac;
  }
  cache.set(s, out);
  return out;
}
