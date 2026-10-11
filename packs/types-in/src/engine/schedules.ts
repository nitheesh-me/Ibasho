/**
 * Hourly schedules, 24 values from midnight for weekday, Saturday and Sunday or holiday
 * (ECBC 2017 and ECSBC 2024 default schedule shapes, adapted to Indian working hours; estimates).
 */
import type { Schedule24x3, SchedulePlugin } from '@ibasho/core';
import { PROV } from './sources.ts';

/** Build a day from [startHour, endHour, value] blocks over a base value. */
export function day(base: number, blocks: [number, number, number][] = []): number[] {
  const out = Array.from({ length: 24 }, () => base);
  for (const [a, b, v] of blocks) for (let h = a; h < b; h++) out[h] = v;
  return out;
}

const s = (scheduleId: string, use: SchedulePlugin['use'], profile: Schedule24x3): SchedulePlugin => ({
  kind: 'schedule',
  id: `types-in-sched-${scheduleId}`,
  version: '0.1.0',
  title: `types.schedule.${scheduleId}`,
  side: 'both',
  regions: ['IN'],
  provenance: PROV,
  scheduleId,
  use,
  profile,
});

const OFFICE_OCC = day(0, [
  [8, 9, 0.3],
  [9, 13, 0.9],
  [13, 14, 0.6],
  [14, 18, 0.9],
  [18, 20, 0.3],
]);
const OFFICE_SAT = day(0, [[9, 14, 0.3]]);
const ZERO = day(0);
const ALL = day(1);

export const SCHEDULES: SchedulePlugin[] = [
  s('office-occ', 'occupancy', { weekday: OFFICE_OCC, saturday: OFFICE_SAT, sunday: ZERO }),
  s('office-light', 'lighting', {
    weekday: day(0.05, [[8, 20, 0.9]]),
    saturday: day(0.05, [[9, 14, 0.4]]),
    sunday: day(0.05),
  }),
  s('office-equip', 'equipment', {
    weekday: day(0.15, [[8, 20, 0.75]]),
    saturday: day(0.15, [[9, 14, 0.4]]),
    sunday: day(0.15),
  }),
  s('office-hvac', 'hvac', { weekday: day(0, [[8, 20, 1]]), saturday: day(0, [[9, 14, 1]]), sunday: ZERO }),
  s('school-occ', 'occupancy', {
    weekday: day(0, [
      [8, 13, 0.95],
      [13, 14, 0.5],
      [14, 17, 0.9],
    ]),
    saturday: day(0, [[9, 13, 0.3]]),
    sunday: ZERO,
  }),
  s('school-light', 'lighting', {
    weekday: day(0.05, [[8, 17, 0.9]]),
    saturday: day(0.05, [[9, 13, 0.4]]),
    sunday: day(0.05),
  }),
  s('school-equip', 'equipment', {
    weekday: day(0.15, [[8, 17, 0.8]]),
    saturday: day(0.15, [[9, 13, 0.3]]),
    sunday: day(0.15),
  }),
  s('school-hvac', 'hvac', { weekday: day(0, [[8, 17, 1]]), saturday: day(0, [[9, 13, 1]]), sunday: ZERO }),
  s('lab-occ', 'occupancy', {
    weekday: day(0, [[9, 20, 0.7]]),
    saturday: day(0, [[10, 17, 0.4]]),
    sunday: day(0, [[11, 16, 0.1]]),
  }),
  s('lab-equip', 'equipment', {
    weekday: day(0.25, [[9, 20, 0.8]]),
    saturday: day(0.25, [[10, 17, 0.6]]),
    sunday: day(0.25),
  }),
  s('lab-hvac', 'hvac', {
    weekday: day(0, [[8, 21, 1]]),
    saturday: day(0, [[10, 17, 1]]),
    sunday: day(0, [[11, 16, 1]]),
  }),
  s('library-occ', 'occupancy', {
    weekday: day(0, [[8, 22, 0.6]]),
    saturday: day(0, [[9, 20, 0.5]]),
    sunday: day(0, [[10, 18, 0.3]]),
  }),
  s('library-hvac', 'hvac', {
    weekday: day(0, [[8, 22, 1]]),
    saturday: day(0, [[9, 20, 1]]),
    sunday: day(0, [[10, 18, 1]]),
  }),
  s('assembly-occ', 'occupancy', {
    weekday: day(0, [
      [10, 12, 0.5],
      [15, 18, 0.6],
    ]),
    saturday: day(0, [[10, 13, 0.3]]),
    sunday: ZERO,
  }),
  s('assembly-hvac', 'hvac', {
    weekday: day(0, [[9, 18, 1]]),
    saturday: day(0, [[10, 13, 1]]),
    sunday: ZERO,
  }),
  s('always', 'hvac', { weekday: ALL, saturday: ALL, sunday: ALL }),
  s('always-equip', 'equipment', { weekday: ALL, saturday: ALL, sunday: ALL }),
  s('circulation-light', 'lighting', {
    weekday: day(0.2, [[7, 21, 0.8]]),
    saturday: day(0.2, [[8, 18, 0.5]]),
    sunday: day(0.2, [[8, 18, 0.3]]),
  }),
  s('none', 'hvac', { weekday: ZERO, saturday: ZERO, sunday: ZERO }),
  s('home-occ', 'occupancy', {
    weekday: day(0.9, [
      [8, 10, 0.5],
      [10, 17, 0.3],
      [17, 22, 0.8],
    ]),
    saturday: day(0.9, [[9, 22, 0.7]]),
    sunday: day(0.9, [[9, 22, 0.8]]),
  }),
  s('home-light', 'lighting', {
    weekday: day(0, [
      [6, 8, 0.4],
      [18, 23, 0.8],
    ]),
    saturday: day(0, [
      [7, 9, 0.3],
      [18, 23, 0.8],
    ]),
    sunday: day(0, [
      [7, 9, 0.3],
      [18, 23, 0.8],
    ]),
  }),
  s('home-equip', 'equipment', {
    weekday: day(0.1, [
      [6, 9, 0.5],
      [18, 23, 0.7],
    ]),
    saturday: day(0.1, [[8, 23, 0.5]]),
    sunday: day(0.1, [[8, 23, 0.5]]),
  }),
  s('living-ac', 'hvac', {
    weekday: day(0, [[18, 23, 1]]),
    saturday: day(0, [
      [13, 17, 1],
      [18, 23, 1],
    ]),
    sunday: day(0, [
      [13, 17, 1],
      [18, 23, 1],
    ]),
  }),
  s('bedroom-ac', 'hvac', {
    weekday: day(0, [
      [0, 6, 1],
      [22, 24, 1],
    ]),
    saturday: day(0, [
      [0, 7, 1],
      [22, 24, 1],
    ]),
    sunday: day(0, [
      [0, 7, 1],
      [22, 24, 1],
    ]),
  }),
  s('home-dhw', 'dhw', {
    weekday: day(0.01, [
      [6, 9, 0.2],
      [19, 22, 0.1],
    ]),
    saturday: day(0.01, [
      [7, 10, 0.2],
      [19, 22, 0.1],
    ]),
    sunday: day(0.01, [
      [7, 10, 0.2],
      [19, 22, 0.1],
    ]),
  }),
  s('hotel-occ', 'occupancy', {
    weekday: day(0.8, [
      [9, 17, 0.3],
      [17, 23, 0.6],
    ]),
    saturday: day(0.8, [[9, 17, 0.4]]),
    sunday: day(0.8, [[9, 17, 0.4]]),
  }),
  s('ward-occ', 'occupancy', {
    weekday: day(0.8, [[9, 20, 1]]),
    saturday: day(0.8, [[9, 20, 1]]),
    sunday: day(0.8, [[9, 20, 1]]),
  }),
];

export const scheduleById = (id: string): SchedulePlugin | undefined =>
  SCHEDULES.find((x) => x.scheduleId === id);
