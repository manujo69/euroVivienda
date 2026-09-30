// State of the explorer: signals for what the user chose, computed for what the views show.
// Depends only on the domain ports (spec.md, «Aplicación Angular: arquitectura hexagonal simplificada»).

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Catalog, IndicatorData } from '@eurovivienda/contract';
import type { IndicatorMeta } from '@eurovivienda/contract';
import {
  type GeoValue,
  headline,
  openCards,
  resolveYear,
  valuesByGeo,
} from '../domain/indicator-rules';
import type { MapGeography } from '../domain/ports';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY } from './tokens';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** One card of the chart panel. */
export interface Card {
  readonly meta: IndicatorMeta;
  readonly open: boolean;
  /** Latest year with data up to the one chosen. */
  readonly year: number | undefined;
  readonly headline: GeoValue | undefined;
}

@Injectable({ providedIn: 'root' })
export class ExplorerStore {
  private readonly indicators = inject(INDICATOR_REPOSITORY);
  private readonly geographies = inject(GEOGRAPHY_REPOSITORY);

  private readonly catalogState = signal<Catalog>([]);
  private readonly mainId = signal<string | undefined>(undefined);
  /** Data of every indicator loaded so far, by id: each one is fetched once. */
  private readonly loaded = signal<Readonly<Record<string, IndicatorData>>>({});
  private readonly data = computed(() => this.loaded()[this.mainId() ?? ''] ?? {});
  private readonly activeIds = signal<readonly string[]>([]);
  private readonly failedIds = signal<ReadonlySet<string>>(new Set());
  /** Active indicators, the card used least recently first. */
  private readonly recency = signal<readonly string[]>([]);

  readonly catalog = this.catalogState.asReadonly();
  /** Active indicators, in the order they were activated. */
  readonly active = this.activeIds.asReadonly();
  /** Indicators whose data could not be loaded. */
  readonly failed = this.failedIds.asReadonly();

  readonly status = signal<LoadStatus>('idle');
  readonly geography = signal<MapGeography | undefined>(undefined);
  readonly year = signal(0);
  readonly breakdown = signal('total');
  readonly selected = signal<string | undefined>(undefined);

  /** The main indicator: it colours the map. */
  readonly meta = computed(() => this.catalogState().find((meta) => meta.id === this.mainId()));
  /** The year on screen: the chosen one, or the latest earlier one with data. */
  readonly shownYear = computed(() => resolveYear(this.data(), this.year()));
  readonly breaks = computed(() => this.meta()?.breaks[this.breakdown()] ?? []);

  private readonly current = computed(() => {
    const meta = this.meta();
    const year = this.shownYear();
    if (!meta || year === undefined) return { values: [], eu: undefined };
    return valuesByGeo(meta, this.data(), year, this.breakdown());
  });
  readonly values = computed(() => this.current().values);
  readonly eu = computed(() => this.current().eu);

  readonly cards = computed((): Card[] => {
    const open = openCards(this.recency());
    return this.activeIds().flatMap((id) => {
      const meta = this.catalogState().find((item) => item.id === id);
      if (!meta) return [];
      const data = this.loaded()[id] ?? {};
      const year = resolveYear(data, this.year());
      // Until each card has its own selector (hito 4), only the main one follows the map breakdown.
      const breakdown =
        id === this.mainId() ? this.breakdown() : (meta.breakdowns[0]?.id ?? 'total');
      const { values, eu } =
        year === undefined
          ? { values: [], eu: undefined }
          : valuesByGeo(meta, data, year, breakdown);
      return [{ meta, open: open.has(id), year, headline: headline(values, eu, this.selected()) }];
    });
  });

  /** Loads the catalogue, the first indicator and the map. Call it in the browser only. */
  async load(): Promise<void> {
    this.status.set('loading');
    try {
      const [catalog, geography] = await Promise.all([
        this.indicators.catalog(),
        this.geographies.nuts0(),
      ]);
      const main = catalog[0];
      if (!main) throw new Error('empty catalogue');
      const data = await this.indicators.data(main.id);
      this.catalogState.set(catalog);
      this.loaded.set({ [main.id]: data });
      this.geography.set(geography);
      this.activeIds.set([main.id]);
      this.recency.set([main.id]);
      this.makeMain(main.id);
      this.year.set(main.years[1]);
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
      // The map goes to the last indicator still active, if any.
      if (this.mainId() === id) this.makeMain(this.activeIds().at(-1));
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
    this.makeMain(id);
  }

  /** Opens a card, folding the one used least recently if four are already open. */
  openCard(id: string): void {
    if (!this.activeIds().includes(id)) return;
    this.recency.update((ids) => [...ids.filter((other) => other !== id), id]);
  }

  /** Puts an active indicator on the map; inactive ones are ignored. */
  setMain(id: string): void {
    if (this.activeIds().includes(id)) this.makeMain(id);
  }

  /** Each main indicator starts on its own first breakdown. */
  private makeMain(id: string | undefined): void {
    this.mainId.set(id);
    this.breakdown.set(this.meta()?.breakdowns[0]?.id ?? 'total');
  }

  setBreakdown(id: string): void {
    if (this.meta()?.breakdowns.some((breakdown) => breakdown.id === id)) this.breakdown.set(id);
  }

  setYear(year: number): void {
    this.year.set(year);
  }

  /** Clicking the selected region again clears the selection. */
  select(geo: string | undefined): void {
    this.selected.update((current) => (current === geo ? undefined : geo));
  }
}
