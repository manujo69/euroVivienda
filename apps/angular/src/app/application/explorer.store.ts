// State of the explorer: signals for what the user chose, computed for what the views show.
// Depends only on the domain ports (spec.md, «Aplicación Angular: arquitectura hexagonal simplificada»).

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { Catalog, IndicatorData } from '@eurovivienda/contract';
import type { IndicatorMeta } from '@eurovivienda/contract';
import {
  type GeoValue,
  headline,
  openCards,
  resolveYear,
  type Level,
  levelOf,
  selectionAt,
  valuesByGeo,
  yearRange,
} from '../domain/indicator-rules';
import { codesOf, namesOf } from '../domain/geography';
import type { MapGeography } from '../domain/ports';
import {
  normalizeUrlState,
  parseUrlState,
  serializeUrlState,
  type UrlState,
} from '../domain/url-state';
import {
  type Axis,
  type Pair,
  isOffered,
  pairLabel,
  pairOptions,
  pearson,
  scatterPoints,
} from '../domain/scatter';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY, URL_STATE } from './tokens';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** The scatter card, when there is one. */
export type Scatter = NonNullable<ReturnType<ExplorerStore['scatter']>>;

/** One card of the chart panel. */
export interface Card {
  readonly meta: IndicatorMeta;
  readonly open: boolean;
  /** Latest year with data up to the one chosen. */
  readonly year: number | undefined;
  readonly headline: GeoValue | undefined;
  readonly breakdown: string;
  /** Every value of the indicator, for its series. */
  readonly data: IndicatorData;
  /** Countries and EU mean at the card's year. */
  readonly values: readonly GeoValue[];
  readonly eu: GeoValue | undefined;
  readonly selected: string | undefined;
  /** Names of the regions on the map, for the NUTS 2 level. */
  readonly names: Readonly<Record<string, string>>;
}

@Injectable({ providedIn: 'root' })
export class ExplorerStore {
  private readonly indicators = inject(INDICATOR_REPOSITORY);
  private readonly geographies = inject(GEOGRAPHY_REPOSITORY);
  private readonly url = inject(URL_STATE);

  private readonly catalogState = signal<Catalog>([]);
  private readonly mainId = signal<string | undefined>(undefined);
  /** Data of every indicator loaded so far, by id: each one is fetched once. */
  private readonly loaded = signal<Readonly<Record<string, IndicatorData>>>({});
  private readonly data = computed(() => this.loaded()[this.mainId() ?? ''] ?? {});
  private readonly activeIds = signal<readonly string[]>([]);
  private readonly failedIds = signal<ReadonlySet<string>>(new Set());
  /** Breakdown chosen for each indicator; the first one it declares until the user picks. */
  private readonly chosenBreakdowns = signal<Readonly<Record<string, string>>>({});
  /** Axes the user chose for the scatter card, if any. */
  private readonly chosenPair = signal<Pair | undefined>(undefined);
  /** Active indicators, the card used least recently first. */
  private readonly recency = signal<readonly string[]>([]);

  readonly catalog = this.catalogState.asReadonly();
  /** Active indicators, in the order they were activated. */
  readonly active = this.activeIds.asReadonly();
  /** Indicators whose data could not be loaded. */
  readonly failed = this.failedIds.asReadonly();

  readonly status = signal<LoadStatus>('idle');
  private readonly levelState = signal<Level>(0);
  /** Geometries loaded so far: NUTS 2 only once the user asks for it. */
  private readonly geographiesByLevel = signal<Partial<Record<Level, MapGeography>>>({});
  /** NUTS level on the map: countries (0) or regions (2). */
  readonly level = this.levelState.asReadonly();
  readonly geography = computed(() => this.geographiesByLevel()[this.level()]);
  /** Names of the regions on the map; countries are named by the domain. */
  readonly names = computed(() => {
    const geography = this.geography();
    return geography ? namesOf(geography.regions) : {};
  });
  /** Regions only for a main indicator with regional data. */
  readonly canShowRegions = computed(() => this.meta()?.levels.includes(2) ?? false);
  private readonly regionCodes = computed(() => {
    const geography = this.geography();
    return this.level() === 2 && geography ? codesOf(geography.regions) : [];
  });
  readonly year = signal(0);
  readonly selected = signal<string | undefined>(undefined);

  /** The main indicator: it colours the map. */
  readonly meta = computed(() => this.catalogState().find((meta) => meta.id === this.mainId()));
  /** The year on screen: the chosen one, or the latest earlier one with data. */
  readonly shownYear = computed(() => resolveYear(this.data(), this.year()));
  /** The map shows the breakdown of the main indicator. */
  readonly breakdown = computed(() => {
    const meta = this.meta();
    return meta ? this.breakdownOf(meta) : 'total';
  });
  readonly breaks = computed(() => this.meta()?.breaks[this.breakdown()] ?? []);

  private readonly current = computed(() => {
    const meta = this.meta();
    const year = this.shownYear();
    if (!meta || year === undefined) return { values: [], eu: undefined };
    return valuesByGeo(meta, this.data(), year, this.breakdown(), this.level(), this.regionCodes());
  });
  readonly values = computed(() => this.current().values);
  readonly eu = computed(() => this.current().eu);

  /** Options of the year selector: the years of the active indicators, newest first. */
  readonly years = computed(() =>
    yearRange(this.catalogState().filter((meta) => this.activeIds().includes(meta.id))),
  );

  readonly cards = computed((): Card[] => {
    const open = openCards(this.recency());
    return this.activeIds().flatMap((id) => {
      const meta = this.catalogState().find((item) => item.id === id);
      if (!meta) return [];
      const data = this.loaded()[id] ?? {};
      const year = resolveYear(data, this.year());
      const breakdown = this.breakdownOf(meta);
      // National indicators stay by country on a NUTS 2 map, on the country of the region selected.
      const level = levelOf(meta, this.level());
      const selected = selectionAt(meta, this.level(), this.selected());
      const { values, eu } =
        year === undefined
          ? { values: [], eu: undefined }
          : valuesByGeo(meta, data, year, breakdown, level, this.regionCodes());
      return [
        {
          meta,
          open: open.has(id),
          year,
          headline: headline(values, eu, selected),
          breakdown,
          data,
          values,
          eu,
          selected,
          names: this.names(),
        },
      ];
    });
  });

  /** Active indicators in activation order. */
  private readonly activeMetas = computed(() =>
    this.activeIds().flatMap((id) => this.catalogState().filter((meta) => meta.id === id)),
  );

  /**
   * The scatter card, with two numeric indicators active or more (spec.md, rule 4): the chosen
   * pair if it is still on offer, else the first suggested one, else the last two indicators.
   */
  readonly scatter = computed(() => {
    const { suggested, axes } = pairOptions(this.activeMetas(), this.level());
    if (axes.length < 2) return undefined;
    const chosen = this.chosenPair();
    const [previous, last] = axes.slice(-2).map((meta) => ({
      id: meta.id,
      breakdown: this.breakdownOf(meta),
    }));
    const pair =
      chosen && isOffered(axes, chosen)
        ? chosen
        : (suggested[0] ?? (previous && last ? { x: previous, y: last } : undefined));
    if (!pair) return undefined;

    const side = (axis: Axis) => {
      const meta = axes.find((item) => item.id === axis.id) as IndicatorMeta;
      const data = this.loaded()[axis.id] ?? {};
      const year = resolveYear(data, this.year());
      const values =
        year === undefined
          ? []
          : valuesByGeo(meta, data, year, axis.breakdown, this.level(), this.regionCodes()).values;
      return { meta, breakdown: axis.breakdown, year, values };
    };
    const [x, y] = [side(pair.x), side(pair.y)];
    const points = scatterPoints(x.values, y.values);
    return {
      pair,
      // Named from the catalogue, for the selectors of the card.
      suggested: suggested.map((option) => ({
        pair: option,
        label: pairLabel(option, this.catalogState()),
      })),
      axes: axes.map((meta) => ({
        id: meta.id,
        breakdown: this.breakdownOf(meta),
        label: meta.label,
      })),
      level: this.level(),
      label: pairLabel(pair, this.catalogState()),
      x,
      y,
      points,
      r: pearson(points.map((point) => [point.x, point.y] as const)),
      selected: this.selected(),
      names: this.names(),
    };
  });

  /** The shareable state, as the URL holds it. */
  private readonly urlState = computed((): UrlState => ({
    ind: this.activeIds(),
    main: this.mainId(),
    geo: this.selected(),
    year: this.year(),
    level: this.level(),
    // Only breakdowns other than the default, to keep the URL short.
    bd: Object.fromEntries(
      this.catalogState()
        .filter((meta) => this.activeIds().includes(meta.id))
        .map((meta) => [meta.id, this.breakdownOf(meta)] as const)
        .filter(([id, breakdown]) => {
          const meta = this.catalogState().find((item) => item.id === id);
          return breakdown !== meta?.breakdowns[0]?.id;
        }),
    ),
  }));

  constructor() {
    // Once the data is in, every change of the state goes to the URL.
    effect(() => {
      if (this.status() !== 'ready') return;
      const params = serializeUrlState(this.urlState());
      untracked(() => void this.url.write(params));
    });
  }

  /**
   * Loads the catalogue, the map and the indicators of the URL, normalised to the nearest valid
   * state (the first indicator of the catalogue if the URL names none). Call it in the browser only.
   */
  async load(): Promise<void> {
    this.status.set('loading');
    try {
      const [catalog, nuts0, query] = await Promise.all([
        this.indicators.catalog(),
        this.geographies.nuts0(),
        this.url.read(),
      ]);
      if (!catalog.length) throw new Error('empty catalogue');
      const requested = parseUrlState(query);
      // The region in the URL is checked against the map of its level.
      const nuts2 = requested.level === 2 ? await this.geographies.nuts2() : undefined;
      let state = normalizeUrlState(requested, catalog, codesOf((nuts2 ?? nuts0).regions));
      // NUTS 2 dropped (the main indicator is national): the region is checked on the countries.
      if (nuts2 && state.level === 0) {
        state = normalizeUrlState({ ...requested, level: 0 }, catalog, codesOf(nuts0.regions));
      }
      const results = await Promise.allSettled(state.ind.map((id) => this.indicators.data(id)));
      const loaded: Record<string, IndicatorData> = {};
      const failed = new Set<string>();
      state.ind.forEach((id, i) => {
        const result = results[i];
        if (result?.status === 'fulfilled') loaded[id] = result.value;
        else failed.add(id);
      });
      const active = state.ind.filter((id) => id in loaded);
      if (!active.length) throw new Error('no indicator could be loaded');

      this.catalogState.set(catalog);
      this.loaded.set(loaded);
      this.failedIds.set(failed);
      this.geographiesByLevel.set(nuts2 ? { 0: nuts0, 2: nuts2 } : { 0: nuts0 });
      this.levelState.set(state.level === 2 ? 2 : 0);
      this.activeIds.set(active);
      this.recency.set(active);
      this.mainId.set(state.main && active.includes(state.main) ? state.main : active.at(-1));
      this.selected.set(state.geo);
      this.chosenBreakdowns.set(state.bd);
      this.year.set(state.year ?? 0);
      this.keepYearInRange();
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  /** Activates an indicator, loading its data the first time, or deactivates it. */
  async toggle(id: string): Promise<void> {
    if (!this.catalogState().some((meta) => meta.id === id)) return;
    if (this.activeIds().includes(id)) {
      this.activeIds.update((ids) => ids.filter((active) => active !== id));
      this.recency.update((ids) => ids.filter((active) => active !== id));
      this.keepYearInRange();
      // The map goes to the last indicator still active, if any.
      if (this.mainId() === id) this.putOnMap(this.activeIds().at(-1));
      return;
    }
    if (!(id in this.loaded())) {
      try {
        const data = await this.indicators.data(id);
        this.loaded.update((loaded) => ({ ...loaded, [id]: data }));
      } catch {
        this.failedIds.update((failed) => new Set(failed).add(id));
        return;
      }
    }
    this.failedIds.update((failed) => new Set([...failed].filter((other) => other !== id)));
    this.activeIds.update((ids) => [...ids, id]);
    this.recency.update((ids) => [...ids, id]);
    this.putOnMap(id);
  }

  /**
   * Shows countries or NUTS 2 regions, loading the NUTS 2 geometry the first time. A country is
   * not a region: the selection goes.
   */
  async setLevel(level: Level): Promise<void> {
    if (level === this.level() || (level === 2 && !this.canShowRegions())) return;
    if (!this.geographiesByLevel()[level]) {
      try {
        const geography = await (level === 2 ? this.geographies.nuts2() : this.geographies.nuts0());
        this.geographiesByLevel.update((loaded) => ({ ...loaded, [level]: geography }));
      } catch {
        return;
      }
    }
    this.selected.set(undefined);
    this.levelState.set(level);
  }

  /** Opens a card, folding the one used least recently if four are already open. */
  openCard(id: string): void {
    if (!this.activeIds().includes(id)) return;
    this.recency.update((ids) => [...ids.filter((other) => other !== id), id]);
  }

  /** Puts an active indicator on the map; inactive ones are ignored. */
  setMain(id: string): void {
    if (this.activeIds().includes(id)) this.putOnMap(id);
  }

  /** A main indicator without regional data takes the map back to the countries. */
  private putOnMap(id: string | undefined): void {
    this.mainId.set(id);
    if (this.level() === 2 && !this.canShowRegions()) {
      this.selected.set(undefined);
      this.levelState.set(0);
    }
  }

  /** Chooses the axes of the scatter card among the ones it offers; any other pair is ignored. */
  setScatterPair(pair: Pair): void {
    const { axes } = pairOptions(this.activeMetas(), this.level());
    if (isOffered(axes, pair)) this.chosenPair.set(pair);
  }

  /** Chooses the breakdown of an indicator; ids it does not declare are ignored. */
  setBreakdown(indicatorId: string, breakdownId: string): void {
    const meta = this.catalogState().find((item) => item.id === indicatorId);
    if (!meta?.breakdowns.some((breakdown) => breakdown.id === breakdownId)) return;
    this.chosenBreakdowns.update((chosen) => ({ ...chosen, [indicatorId]: breakdownId }));
  }

  private breakdownOf(meta: IndicatorMeta): string {
    return this.chosenBreakdowns()[meta.id] ?? meta.breakdowns[0]?.id ?? 'total';
  }

  setYear(year: number): void {
    if (this.years().includes(year)) this.year.set(year);
  }

  /** The chosen year stays among the selector options when the range shrinks. */
  private keepYearInRange(): void {
    const [last, first] = [this.years()[0], this.years().at(-1)];
    if (last === undefined || first === undefined) return;
    this.year.set(Math.min(Math.max(this.year(), first), last));
  }

  /** Clicking the selected region again clears the selection. */
  select(geo: string | undefined): void {
    this.selected.update((current) => (current === geo ? undefined : geo));
  }
}
