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

const tenure: IndicatorMeta = {
  ...overburden,
  id: 'tenure',
  label: 'Régimen de tenencia',
  kind: 'composition',
  categories: ['own', 'rent'],
  mapCategory: 'rent',
  breakdowns: [{ id: 'total', label: 'Total' }],
  breaks: { total: [20, 30] },
};

const tenureData: IndicatorData = {
  ES: { '2024': { total: { v: { own: 75.3, rent: 24.7 } } } },
};

const empty = { type: 'FeatureCollection' as const, features: [] };
const geography: MapGeography = { regions: empty, context: empty };

const byId: Record<string, IndicatorData> = { overburden: data, tenure: tenureData };

function setup(indicators: Partial<IndicatorRepository> = {}) {
  const repository: IndicatorRepository = {
    catalog: () => Promise.resolve([overburden, tenure] as Catalog),
    data: (id) => (byId[id] ? Promise.resolve(byId[id]) : Promise.reject(new Error('404'))),
    ...indicators,
  };
  const dataSpy = spyOn(repository, 'data').and.callThrough();
  const geographies: GeographyRepository = { nuts0: () => Promise.resolve(geography) };
  TestBed.configureTestingModule({
    providers: [
      ExplorerStore,
      { provide: INDICATOR_REPOSITORY, useValue: repository },
      { provide: GEOGRAPHY_REPOSITORY, useValue: geographies },
    ],
  });
  return Object.assign(TestBed.inject(ExplorerStore), { repository: { data: dataSpy } });
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

  describe('catalogue', () => {
    it('starts with the first indicator of the catalogue active', async () => {
      const store = setup();
      await store.load();

      expect(store.catalog().map((meta) => meta.id)).toEqual(['overburden', 'tenure']);
      expect(store.active()).toEqual(['overburden']);
    });

    it('activates an indicator, loading its data', async () => {
      const store = setup();
      await store.load();

      await store.toggle('tenure');

      expect(store.active()).toEqual(['overburden', 'tenure']);
      expect(store.repository.data).toHaveBeenCalledWith('tenure');
    });

    it('deactivates an active indicator', async () => {
      const store = setup();
      await store.load();
      await store.toggle('tenure');

      await store.toggle('overburden');

      expect(store.active()).toEqual(['tenure']);
    });

    it('loads the data of an indicator only once', async () => {
      const store = setup();
      await store.load();

      await store.toggle('tenure');
      await store.toggle('tenure');
      await store.toggle('tenure');

      expect(store.active()).toEqual(['overburden', 'tenure']);
      expect(store.repository.data.calls.allArgs()).toEqual([['overburden'], ['tenure']]);
    });

    it('leaves an indicator off and marks it when its data fails to load', async () => {
      const store = setup({
        data: (id) => (id === 'tenure' ? Promise.reject(new Error('404')) : Promise.resolve(data)),
      });
      await store.load();

      await store.toggle('tenure');

      expect(store.active()).toEqual(['overburden']);
      expect(store.failed().has('tenure')).toBeTrue();
      expect(store.status()).toBe('ready');
    });

    it('ignores ids that are not in the catalogue', async () => {
      const store = setup();
      await store.load();

      await store.toggle('unknown');

      expect(store.active()).toEqual(['overburden']);
      expect(store.repository.data).not.toHaveBeenCalledWith('unknown');
    });
  });

  describe('main indicator', () => {
    it('makes the last indicator activated the main one', async () => {
      const store = setup();
      await store.load();

      await store.toggle('tenure');

      expect(store.meta()?.id).toBe('tenure');
      expect(store.values()).toEqual([{ geo: 'ES', value: 24.7, flags: undefined }]);
      expect(store.breaks()).toEqual([20, 30]);
    });

    it('hands the map to the last active indicator when the main one is switched off', async () => {
      const store = setup();
      await store.load();
      await store.toggle('tenure');

      await store.toggle('tenure');

      expect(store.meta()?.id).toBe('overburden');
    });

    it('keeps the main indicator when another one is switched off', async () => {
      const store = setup();
      await store.load();
      await store.toggle('tenure');
      store.setMain('overburden');

      await store.toggle('tenure');

      expect(store.meta()?.id).toBe('overburden');
    });

    it('has no main indicator and nothing to map when none is active', async () => {
      const store = setup();
      await store.load();

      await store.toggle('overburden');

      expect(store.meta()).toBeUndefined();
      expect(store.values()).toEqual([]);
      expect(store.eu()).toBeUndefined();
    });

    it('lets the user choose the main one among the active indicators only', async () => {
      const store = setup();
      await store.load();
      await store.toggle('tenure');

      store.setMain('overburden');
      expect(store.meta()?.id).toBe('overburden');

      await store.toggle('tenure');
      store.setMain('tenure');
      expect(store.meta()?.id).toBe('overburden');
    });

    it('starts the new main indicator on its first breakdown', async () => {
      const store = setup();
      await store.load();
      store.setBreakdown('youth');

      await store.toggle('tenure');
      expect(store.breakdown()).toBe('total');

      store.setBreakdown('youth');
      store.setMain('overburden');
      expect(store.breakdown()).toBe('total');
    });
  });
});
