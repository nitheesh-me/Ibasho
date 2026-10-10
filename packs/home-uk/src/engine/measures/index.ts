/**
 * Every UK measure model, in measure id order of `../../ids.ts`. Owner: WP-01.
 */
import type { MeasureModel } from '@ibasho/core';
import { ashpMeasure } from './ashp.ts';
import { controlsMeasure } from './controls.ts';
import { cylinderJacketMeasure, cylinderMeasure, hobMeasure, solarThermalMeasure } from './dhw.ts';
import { draughtMeasure } from './draught.ts';
import { floorMeasure } from './floor.ts';
import { glazingDoubleMeasure, glazingSecondaryMeasure } from './glazing.ts';
import { loftMeasure } from './loft.ts';
import { mvhrMeasure } from './mvhr.ts';
import { batteryMeasure, pvMeasure } from './pv.ts';
import { wallEwiMeasure, wallIwiMeasure } from './wall.ts';

export const UK_MEASURES: readonly MeasureModel[] = [
  loftMeasure,
  wallEwiMeasure,
  wallIwiMeasure,
  floorMeasure,
  draughtMeasure,
  glazingSecondaryMeasure,
  glazingDoubleMeasure,
  controlsMeasure,
  mvhrMeasure,
  ashpMeasure,
  pvMeasure,
  batteryMeasure,
  cylinderJacketMeasure,
  solarThermalMeasure,
  cylinderMeasure,
  hobMeasure,
];

export {
  ashpMeasure,
  batteryMeasure,
  controlsMeasure,
  cylinderJacketMeasure,
  cylinderMeasure,
  draughtMeasure,
  floorMeasure,
  glazingDoubleMeasure,
  glazingSecondaryMeasure,
  hobMeasure,
  loftMeasure,
  mvhrMeasure,
  pvMeasure,
  solarThermalMeasure,
  wallEwiMeasure,
  wallIwiMeasure,
};
