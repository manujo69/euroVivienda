// State of the explorer: signals for what the user chose, computed for what the views show.
// Depends only on the domain ports (spec.md, «Aplicación Angular: arquitectura hexagonal simplificada»).

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Catalog, IndicatorData } from '@eurovivienda/contract';
import { resolveYear, valuesByGeo } from '../domain/indicator-rules';
import type { MapGeography } from '../domain/ports';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY } from './tokens';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class ExplorerStore {
  private readonly indicators = inject(INDICATOR_REPOSITORY);
  private readonly geographies = inject(GEOGRAPHY_REPOSITORY);

  private readonly catalog = signal<Catalog>([]);
  private readonly mainId = signal<string | undefined>(undefined);
  private readonly data = signal<IndicatorData>({});

  readonly status = signal<LoadStatus>('idle');
  readonly geography = signal<MapGeography | undefined>(undefined);
  readonly year = signal(0);
  readonly breakdown = signal('total');
  readonly selected = signal<string | undefined>(undefined);

  /** The main indicator: it colours the map. */
  readonly meta = computed(() => this.catalog().find((meta) => meta.id === this.mainId()));
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
      this.catalog.set(catalog);
      this.data.set(data);
      this.geography.set(geography);
      this.mainId.set(main.id);
      this.year.set(main.years[1]);
      this.breakdown.set(main.breakdowns[0]?.id ?? 'total');
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
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
