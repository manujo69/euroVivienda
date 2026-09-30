// The scatter card (spec.md, «Reglas de interacción», 4): two indicators against each other, with
// their correlation. Relations are descriptive, never causal.

import type { IndicatorMeta } from '@eurovivienda/contract';
import type { GeoValue, Level } from './indicator-rules';

/** One axis: an indicator on one of its breakdowns. */
export interface Axis {
  readonly id: string;
  readonly breakdown: string;
}

export interface Pair {
  readonly x: Axis;
  readonly y: Axis;
}

export interface ScatterPoint {
  readonly geo: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Suggested pairs of spec.md: price against income, overburden of the young against the age of
 * emancipation, and overburden against unemployment.
 */
const SUGGESTED: readonly Pair[] = [
  { x: { id: 'income', breakdown: 'total' }, y: { id: 'hpi', breakdown: 'total' } },
  { x: { id: 'emancipation', breakdown: 'total' }, y: { id: 'overburden', breakdown: 'youth' } },
  { x: { id: 'unemployment', breakdown: 'total' }, y: { id: 'overburden', breakdown: 'total' } },
];

/** Pearson's r, or nothing with fewer than three points or without spread on an axis. */
export function pearson(points: readonly (readonly [number, number])[]): number | undefined {
  const n = points.length;
  if (n < 3) return undefined;
  const mean = (i: 0 | 1) => points.reduce((sum, point) => sum + point[i], 0) / n;
  const [mx, my] = [mean(0), mean(1)];
  let [sxy, sxx, syy] = [0, 0, 0];
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : undefined;
}

/** The regions with a value on both axes, in the order of the x values given. */
export function scatterPoints(xs: readonly GeoValue[], ys: readonly GeoValue[]): ScatterPoint[] {
  const byGeo = new Map(ys.map((entry) => [entry.geo, entry.value]));
  return xs.flatMap((entry) => {
    const y = byGeo.get(entry.geo);
    return y === undefined ? [] : [{ geo: entry.geo, x: entry.value, y }];
  });
}

/**
 * What the scatter card offers among the active indicators: the numeric ones (compositions have
 * no single value), only the regional ones at NUTS 2, and the suggested pairs they complete.
 */
export function pairOptions(
  active: readonly IndicatorMeta[],
  level: Level,
): { suggested: Pair[]; axes: IndicatorMeta[] } {
  const axes = active.filter(
    (meta) => meta.kind !== 'composition' && (level === 0 || meta.levels.includes(2)),
  );
  return { suggested: SUGGESTED.filter((pair) => isOffered(axes, pair)), axes };
}

/** A pair of two different indicators among the axes, each on a breakdown it declares. */
export function isOffered(axes: readonly IndicatorMeta[], pair: Pair): boolean {
  const offers = (axis: Axis) =>
    axes.some(
      (meta) => meta.id === axis.id && meta.breakdowns.some((b) => b.id === axis.breakdown),
    );
  return pair.x.id !== pair.y.id && offers(pair.x) && offers(pair.y);
}

/** «Y frente a X», with the catalogue labels and the breakdown when it is not the first one. */
export function pairLabel(pair: Pair, catalog: readonly IndicatorMeta[]): string {
  const name = (axis: Axis) => {
    const meta = catalog.find((item) => item.id === axis.id);
    if (!meta) return axis.id;
    const breakdown = meta.breakdowns.find((item) => item.id === axis.breakdown);
    const first = meta.breakdowns[0]?.id === axis.breakdown;
    return breakdown && !first ? `${meta.label} (${breakdown.label})` : meta.label;
  };
  return `${name(pair.y)} frente a ${name(pair.x)}`;
}
