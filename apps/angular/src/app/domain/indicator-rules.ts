// Pure rules over the published indicators (spec.md, «Gráficos por tipo de indicador»).

import type { IndicatorData, IndicatorMeta } from '@eurovivienda/contract';

type Cell = IndicatorData[string][string][string];

export const EU_AGGREGATE = 'EU27_2020';

export interface GeoValue {
  readonly geo: string;
  readonly value: number;
  /** Eurostat flags, e.g. 'p' provisional. */
  readonly flags: string | undefined;
  /** Explanation of this value, e.g. a small sample (from the ETL). */
  readonly note?: string;
}

/** What the map paints: the value, the change since 2015 of an index, the map category of a composition. */
export function mapValue(meta: IndicatorMeta, cell: Cell): number | undefined {
  if (typeof cell.v === 'number') return meta.kind === 'index' ? cell.v - 100 : cell.v;
  return meta.mapCategory === undefined ? undefined : cell.v[meta.mapCategory];
}

/** Class of a value against ascending breaks: 0 below the first, breaks.length at or above the last. */
export function classOf(value: number, breaks: readonly number[]): number {
  return breaks.filter((limit) => value >= limit).length;
}

/** The requested year if it has data, else the latest earlier one (spec.md, «Riesgos»). */
export function resolveYear(data: IndicatorData, requested: number): number | undefined {
  const years = new Set(Object.values(data).flatMap((byYear) => Object.keys(byYear).map(Number)));
  return [...years].filter((year) => year <= requested).sort((a, b) => b - a)[0];
}

/** Values of one year and breakdown, countries sorted by code and the EU mean apart. */
export function valuesByGeo(
  meta: IndicatorMeta,
  data: IndicatorData,
  year: number,
  breakdown: string,
): { values: GeoValue[]; eu: GeoValue | undefined } {
  const all: GeoValue[] = [];
  for (const [geo, byYear] of Object.entries(data)) {
    const cell = byYear[String(year)]?.[breakdown];
    const value = cell && mapValue(meta, cell);
    if (cell && value !== undefined) {
      all.push({ geo, value, flags: cell.f, ...(cell.n ? { note: cell.n } : {}) });
    }
  }
  all.sort((a, b) => a.geo.localeCompare(b.geo));
  return {
    values: all.filter((entry) => entry.geo !== EU_AGGREGATE),
    eu: all.find((entry) => entry.geo === EU_AGGREGATE),
  };
}
