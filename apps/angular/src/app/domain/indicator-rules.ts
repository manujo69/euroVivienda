// Pure rules over the published indicators (spec.md, «Gráficos por tipo de indicador»).

import type { IndicatorData, IndicatorMeta } from '@eurovivienda/contract';

type Cell = IndicatorData[string][string][string];

export const EU_AGGREGATE = 'EU27_2020';

/** NUTS 0 codes are the two letters of the country; NUTS 2 regions add two characters. */
const isCountry = (geo: string) => geo.length === 2;

export interface GeoValue {
  readonly geo: string;
  readonly value: number;
  /** Eurostat flags, e.g. 'p' provisional. */
  readonly flags: string | undefined;
  /** Explanation of this value, e.g. a small sample (from the ETL). */
  readonly note?: string;
}

/** NUTS level on the map: countries (0) or regions (2). */
export type Level = 0 | 2;

/** The level an indicator is shown at: national indicators stay by country on a NUTS 2 map. */
export function levelOf(meta: IndicatorMeta, level: Level): Level {
  return meta.levels.includes(2) ? level : 0;
}

/** What an indicator selects: the country of the selected region, if it is national. */
export function selectionAt(
  meta: IndicatorMeta,
  level: Level,
  selected: string | undefined,
): string | undefined {
  return levelOf(meta, level) === level ? selected : selected?.slice(0, 2);
}

/** What the map paints: the value, the change since 2015 of an index, the map category of a composition. */
export function mapValue(meta: IndicatorMeta, cell: Cell): number | undefined {
  if (typeof cell.v === 'number') return meta.kind === 'index' ? cell.v - 100 : cell.v;
  return meta.mapCategory === undefined ? undefined : cell.v[meta.mapCategory.id];
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
  level: Level = 0,
  /** At NUTS 2, the regions on the map. */
  regions: readonly string[] = [],
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
  const eu = all.find((entry) => entry.geo === EU_AGGREGATE);
  // Countries only at NUTS 0: regional indicators also carry their NUTS 2 regions.
  if (level === 0) return { values: all.filter((entry) => isCountry(entry.geo)), eu };
  // At NUTS 2, only regional indicators have values: national ones stay by country (levelOf).
  if (!meta.levels.includes(2)) return { values: [], eu };
  const onMap = new Set(regions);
  return { values: all.filter((entry) => onMap.has(entry.geo)), eu };
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

export interface Slice {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

/** Slices of a composition for one region and year, in catalogue order. */
export function slicesOf(
  meta: IndicatorMeta,
  data: IndicatorData,
  geo: string,
  year: number,
  breakdown: string,
): Slice[] {
  const v = data[geo]?.[String(year)]?.[breakdown]?.v;
  if (v === undefined || typeof v === 'number') return [];
  return (meta.categories ?? []).flatMap(({ id, label }) =>
    v[id] === undefined ? [] : [{ id, label, value: v[id] }],
  );
}

/** Every year covered by the given indicators, newest first: the options of the year selector. */
export function yearRange(metas: readonly IndicatorMeta[]): number[] {
  if (!metas.length) return [];
  const last = Math.max(...metas.map((meta) => meta.years[1]));
  const first = Math.min(...metas.map((meta) => meta.years[0]));
  return Array.from({ length: last - first + 1 }, (_, i) => last - i);
}
