import { TestBed } from '@angular/core/testing';
import type { Catalog, IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import type { GeographyRepository, IndicatorRepository, MapGeography } from '../domain/ports';
import { ExplorerStore } from './explorer.store';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY } from './tokens';

const overburden: IndicatorMeta = {
  id: 'overburden',
  label: 'Sobrecarga por coste de vivienda',
  theme: 'access',
  kind: 'scalar',
  unit: '%',
  levels: [0],
  years: [2015, 2025],
  source: {
    name: 'Eurostat',
    code: 'ilc_lvho07a',
    url: 'https://example.test',
    lastUpdate: '2026-09-17',
  },
  breakdowns: [
    { id: 'total', label: 'Total' },
    { id: 'youth', label: 'Jóvenes (20–29 años)' },
  ],
  scale: 'sequential',
  breaks: { total: [5, 8], youth: [6, 10] },
};

const data: IndicatorData = {
  ES: { '2024': { total: { v: 7.8 }, youth: { v: 7.2 } } },
  PT: { '2024': { total: { v: 5.1 } } },
  EU27_2020: { '2024': { total: { v: 8.2 } } },
};

const empty = { type: 'FeatureCollection' as const, features: [] };
const geography: MapGeography = { regions: empty, context: empty };

function setup(indicators: Partial<IndicatorRepository> = {}) {
  const repository: IndicatorRepository = {
    catalog: () => Promise.resolve([overburden] as Catalog),
    data: () => Promise.resolve(data),
    ...indicators,
  };
  const geographies: GeographyRepository = { nuts0: () => Promise.resolve(geography) };
  TestBed.configureTestingModule({
    providers: [
      ExplorerStore,
      { provide: INDICATOR_REPOSITORY, useValue: repository },
      { provide: GEOGRAPHY_REPOSITORY, useValue: geographies },
    ],
  });
  return TestBed.inject(ExplorerStore);
}

describe('ExplorerStore', () => {
  it('starts idle, then loads the catalogue, the main indicator and the map', async () => {
    const store = setup();
    expect(store.status()).toBe('idle');

    await store.load();

    expect(store.status()).toBe('ready');
    expect(store.meta()?.id).toBe('overburden');
    expect(store.geography()).toBe(geography);
    expect(store.breakdown()).toBe('total');
    expect(store.year()).toBe(2025);
  });

  it('shows the latest year with data when the selected one has none', async () => {
    const store = setup();
    await store.load();

    expect(store.shownYear()).toBe(2024);
    expect(store.values().map((entry) => entry.geo)).toEqual(['ES', 'PT']);
    expect(store.eu()?.value).toBe(8.2);
    expect(store.breaks()).toEqual([5, 8]);
  });

  it('switches breakdown, ignoring ids the indicator does not declare', async () => {
    const store = setup();
    await store.load();

    store.setBreakdown('youth');
    expect(store.values()).toEqual([{ geo: 'ES', value: 7.2, flags: undefined }]);
    expect(store.breaks()).toEqual([6, 10]);

    store.setBreakdown('unknown');
    expect(store.breakdown()).toBe('youth');
  });

  it('selects a region and clears the selection when clicked again', async () => {
    const store = setup();
    await store.load();

    store.select('ES');
    expect(store.selected()).toBe('ES');
    store.select('ES');
    expect(store.selected()).toBeUndefined();
  });

  it('reports an error when the data cannot be loaded', async () => {
    const store = setup({ data: () => Promise.reject(new Error('404')) });
    await store.load();
    expect(store.status()).toBe('error');
  });
});
