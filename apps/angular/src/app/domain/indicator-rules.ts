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

export type Theme = IndicatorMeta['theme'];

const THEMES: readonly Theme[] = ['prices', 'access', 'context'];

/** The catalogue by theme, in the order of spec.md; themes without indicators are left out. */
export function byTheme(
  catalog: readonly IndicatorMeta[],
): { theme: Theme; indicators: IndicatorMeta[] }[] {
  return THEMES.map((theme) => ({
    theme,
    indicators: catalog.filter((meta) => meta.theme === theme),
  })).filter((group) => group.indicators.length > 0);
}

/** At most four cards open (spec.md, «Reglas de interacción»): the ones used most recently. */
export function openCards(recency: readonly string[], limit = 4): ReadonlySet<string> {
  return new Set(recency.slice(-limit));
}

/** The figure a card leads with: the selected region's value, else the EU mean. */
export function headline(
  values: readonly GeoValue[],
  eu: GeoValue | undefined,
  selected: string | undefined,
): GeoValue | undefined {
  return values.find((entry) => entry.geo === selected) ?? eu;
}

export interface Point {
  readonly year: number;
  readonly value: number;
  readonly flags: string | undefined;
}

/** Values of one region and breakdown over the years, oldest first; compositions have none. */
export function timeSeries(data: IndicatorData, geo: string, breakdown: string): Point[] {
  return Object.entries(data[geo] ?? {})
    .flatMap(([year, byBreakdown]) => {
      const cell = byBreakdown[breakdown];
      return cell && typeof cell.v === 'number'
        ? [{ year: Number(year), value: cell.v, flags: cell.f }]
        : [];
    })
    .sort((a, b) => a.year - b.year);
}

export interface RankedValue extends GeoValue {
  /** Position from the highest value, starting at 1. */
  readonly rank: number;
}

/** Short ranking (spec.md, «Gráficos por tipo»): top and bottom three, plus the selected region. */
export function shortRanking(
  values: readonly GeoValue[],
  selected: string | undefined,
  size = 3,
): RankedValue[] {
  const ranked = [...values]
    .sort((a, b) => b.value - a.value)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
  return ranked.filter(
    (entry, i) => i < size || i >= ranked.length - size || entry.geo === selected,
  );
}
