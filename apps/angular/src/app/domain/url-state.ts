// The shareable state in the URL (spec.md, «Reglas de interacción», 7):
// ?ind=hpi,overburden&main=hpi&geo=ES&year=2023&level=0&bd=overburden:youth

import type { IndicatorMeta } from '@eurovivienda/contract';
import { yearRange } from './indicator-rules';

export interface UrlState {
  /** Active indicators, in activation order. */
  readonly ind: readonly string[];
  /** The indicator on the map. */
  readonly main: string | undefined;
  /** Selected region. */
  readonly geo: string | undefined;
  readonly year: number | undefined;
  /** NUTS level: 0 until NUTS 2 arrives (hito 5). */
  readonly level: number;
  /** Breakdown by indicator, only where it is not the first one. */
  readonly bd: Readonly<Record<string, string>>;
}

export type QueryParams = Readonly<Record<string, string | undefined>>;

const list = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : []);

const integer = (value: string | undefined) => {
  const number = Number(value);
  return value && Number.isInteger(number) ? number : undefined;
};

export function parseUrlState(params: QueryParams): UrlState {
  const bd: Record<string, string> = {};
  for (const pair of list(params['bd'])) {
    const [indicator, breakdown] = pair.split(':');
    if (indicator && breakdown) bd[indicator] = breakdown;
  }
  return {
    ind: list(params['ind']),
    main: params['main'] || undefined,
    geo: params['geo'] || undefined,
    year: integer(params['year']),
    level: integer(params['level']) ?? 0,
    bd,
  };
}

export function serializeUrlState(state: UrlState): Record<string, string> {
  const bd = Object.entries(state.bd).map(([indicator, breakdown]) => `${indicator}:${breakdown}`);
  return {
    ind: state.ind.join(','),
    ...(state.main ? { main: state.main } : {}),
    ...(state.geo ? { geo: state.geo } : {}),
    ...(state.year !== undefined ? { year: String(state.year) } : {}),
    level: String(state.level),
    ...(bd.length ? { bd: bd.join(',') } : {}),
  };
}

/** The nearest valid state: what a shared URL shows once its invalid parts are dropped. */
export function normalizeUrlState(
  state: UrlState,
  catalog: readonly IndicatorMeta[],
  geos: readonly string[],
): UrlState {
  const known = [...new Set(state.ind)].filter((id) => catalog.some((meta) => meta.id === id));
  const ind = known.length ? known : catalog.slice(0, 1).map((meta) => meta.id);
  const active = ind.flatMap((id) => catalog.filter((meta) => meta.id === id));

  const years = yearRange(active);
  const [last, first] = [years[0], years.at(-1)];
  const year =
    last === undefined || first === undefined
      ? undefined
      : Math.min(Math.max(state.year ?? last, first), last);

  const bd: Record<string, string> = {};
  for (const meta of active) {
    const chosen = state.bd[meta.id];
    const declared = meta.breakdowns.slice(1).some((breakdown) => breakdown.id === chosen);
    if (chosen && declared) bd[meta.id] = chosen;
  }

  return {
    ind,
    main: state.main && ind.includes(state.main) ? state.main : ind.at(-1),
    geo: state.geo && geos.includes(state.geo) ? state.geo : undefined,
    year,
    level: 0,
    bd,
  };
}
