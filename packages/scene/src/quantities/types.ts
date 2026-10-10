/**
 * What the scene layers draw, as plain props (ARCH 10, SPEC 7). Owner: WP-07.
 *
 * Layers never compute physics. They read these numbers, which come from the engine's
 * evidence graph (`fromGraph`) or, before the engine lands, from a fixture computed from twin
 * fields (`fromTwin`, tagged `source: 'twin-fixture'`). Every number carries the evidence id it
 * came from when there is one, so a click opens that node (AC-V1).
 */
import type { EvidenceId } from '@ibasho/core';

/** The condition the snapshot describes. Copy must name it (DESIGN_SYSTEM 10). */
export interface SceneCondition {
  /** Indoor (zone mean) temperature, degrees C. */
  thetaInC: number;
  /** Outdoor temperature, degrees C. */
  thetaOutC: number;
  /** Plain words, e.g. "a typical January night, 4 °C outside". */
  label: string;
}

export interface ElementFlow {
  elementId: string;
  /** Fabric heat loss at the condition, W (U times A times delta T). */
  watts: number;
  /** W/K. */
  ua: number;
  /** W/m2K. */
  u: number;
  areaM2: number;
  /** Interior surface temperature at the condition, degrees C. */
  surfaceC: number;
  evidenceId?: EvidenceId;
}

export interface JunctionFlow {
  junctionId: string;
  psi: number;
  lengthM: number;
  /** psi times delta T, W/m: brightness in the lens (DESIGN_SYSTEM 10). */
  wPerM: number;
  watts: number;
  evidenceId?: EvidenceId;
}

export interface ZoneTemp {
  zone: 'living' | 'rest';
  tempC: number;
  evidenceId?: EvidenceId;
}

export interface LeakPath {
  /** Element the air leaves through (door, window, chimney host), if any. */
  elementId?: string;
  /** `chimney` for an open flue, `gaps` for frames and boards. */
  kind: 'chimney' | 'gaps';
  watts: number;
}

export interface SceneQuantities {
  source: 'engine' | 'twin-fixture';
  condition: SceneCondition;
  elements: ElementFlow[];
  junctions: JunctionFlow[];
  zones: ZoneTemp[];
  /** Ventilation and infiltration loss at the condition, W. */
  ventilationW: number;
  ventilationEvidenceId?: EvidenceId;
  leaks: LeakPath[];
}

export const WATTS_PER_MOTE = 10;

export function totalFabricW(q: SceneQuantities): number {
  return q.elements.reduce((s, e) => s + e.watts, 0) + q.junctions.reduce((s, j) => s + j.watts, 0);
}
