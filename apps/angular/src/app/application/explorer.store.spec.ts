import { TestBed } from '@angular/core/testing';
import type { Catalog, IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import type { GeographyRepository, IndicatorRepository, MapGeography } from '../domain/ports';
import type { QueryParams } from '../domain/url-state';
import { ExplorerStore } from './explorer.store';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY, URL_STATE } from './tokens';

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
  categories: [
    { id: 'own', label: 'Propietarios' },
    { id: 'rent', label: 'Inquilinos' },
  ],
  mapCategory: { id: 'rent', label: 'Inquilinos' },
  breakdowns: [{ id: 'total', label: 'Total' }],
  breaks: { total: [20, 30] },
};

const tenureData: IndicatorData = {
  ES: { '2024': { total: { v: { own: 75.3, rent: 24.7 } } } },
};

const empty = { type: 'FeatureCollection' as const, features: [] };
const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};
const geography: MapGeography = {
  regions: {
    type: 'FeatureCollection',
    features: ['ES', 'PT'].map((code) => ({
      type: 'Feature' as const,
      properties: { code },
      geometry: square,
    })),
  },
  context: empty,
};

const regional: MapGeography = {
  regions: {
    type: 'FeatureCollection',
    features: [
      ['ES30', 'Comunidad de Madrid'],
      ['ES51', 'Cataluña'],
      ['PT17', 'Área Metropolitana de Lisboa'],
    ].map(([code, name]) => ({
      type: 'Feature' as const,
      properties: { code, name },
      geometry: square,
    })),
  },
  context: empty,
};

const byId: Record<string, IndicatorData> = { overburden: data, tenure: tenureData };

function setup(indicators: Partial<IndicatorRepository> = {}, query: QueryParams = {}) {
  const repository: IndicatorRepository = {
    catalog: () => Promise.resolve([overburden, tenure] as Catalog),
    data: (id) => (byId[id] ? Promise.resolve(byId[id]) : Promise.reject(new Error('404'))),
    ...indicators,
  };
  const dataSpy = spyOn(repository, 'data').and.callThrough();
  const geographies: GeographyRepository = {
    nuts0: () => Promise.resolve(geography),
    nuts2: () => Promise.resolve(regional),
  };
  const nuts2Spy = spyOn(geographies, 'nuts2').and.callThrough();
  const url = {
    read: () => Promise.resolve(query),
    write: jasmine.createSpy('write').and.resolveTo(),
  };
  TestBed.configureTestingModule({
    providers: [
      ExplorerStore,
      { provide: INDICATOR_REPOSITORY, useValue: repository },
      { provide: GEOGRAPHY_REPOSITORY, useValue: geographies },
      { provide: URL_STATE, useValue: url },
    ],
  });
  return Object.assign(TestBed.inject(ExplorerStore), {
    repository: { data: dataSpy },
    urlPort: url,
    nuts2: nuts2Spy,
  });
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

    store.setBreakdown('overburden', 'youth');
    expect(store.values()).toEqual([{ geo: 'ES', value: 7.2, flags: undefined }]);
    expect(store.breaks()).toEqual([6, 10]);

    store.setBreakdown('overburden', 'unknown');
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

    it('maps each indicator on its own breakdown, kept while it is not the main one', async () => {
      const store = setup();
      await store.load();
      store.setBreakdown('overburden', 'youth');

      await store.toggle('tenure');
      expect(store.breakdown()).toBe('total');

      store.setMain('overburden');
      expect(store.breakdown()).toBe('youth');
    });
  });

  describe('cards', () => {
    const scalar = (id: string): IndicatorMeta => ({ ...overburden, id, label: id });
    const many = ['a', 'b', 'c', 'd', 'e'].map(scalar);

    async function withMany() {
      const store = setup({
        catalog: () => Promise.resolve(many),
        data: () => Promise.resolve(data),
      });
      await store.load();
      for (const meta of many.slice(1)) await store.toggle(meta.id);
      return store;
    }

    const summary = (store: ExplorerStore) =>
      store.cards().map((card) => [card.meta.id, card.open]);

    it('gives one card per active indicator, in activation order', async () => {
      const store = setup();
      await store.load();
      await store.toggle('tenure');

      expect(store.cards().map((card) => card.meta.id)).toEqual(['overburden', 'tenure']);
    });

    it('folds the oldest cards beyond four', async () => {
      const store = await withMany();
      expect(summary(store)).toEqual([
        ['a', false],
        ['b', true],
        ['c', true],
        ['d', true],
        ['e', true],
      ]);
    });

    it('opens a folded card, folding the one used least recently', async () => {
      const store = await withMany();

      store.openCard('a');

      expect(summary(store)).toEqual([
        ['a', true],
        ['b', false],
        ['c', true],
        ['d', true],
        ['e', true],
      ]);
    });

    it('opens the next folded card when an open one is switched off', async () => {
      const store = await withMany();

      await store.toggle('e');

      expect(summary(store)).toEqual([
        ['a', true],
        ['b', true],
        ['c', true],
        ['d', true],
      ]);
    });

    it('leads each card with the EU mean, or with the selected region when it has a value', async () => {
      const store = setup();
      await store.load();
      await store.toggle('tenure');
      const headlines = () =>
        store.cards().map((card) => [card.meta.id, card.headline?.geo, card.headline?.value]);

      expect(headlines()).toEqual([
        ['overburden', 'EU27_2020', 8.2],
        ['tenure', undefined, undefined],
      ]);

      store.select('ES');
      expect(headlines()).toEqual([
        ['overburden', 'ES', 7.8],
        ['tenure', 'ES', 24.7],
      ]);
    });

    it('gives each card the data, values and selection its charts need', async () => {
      const store = setup();
      await store.load();
      store.select('PT');
      const [card] = store.cards();

      expect(card?.data).toBe(data);
      expect(card?.breakdown).toBe('total');
      expect(card?.values.map((entry) => entry.geo)).toEqual(['ES', 'PT']);
      expect(card?.eu?.value).toBe(8.2);
      expect(card?.selected).toBe('PT');
    });

    it('shows each card at its latest year with data', async () => {
      const store = setup();
      await store.load();
      expect(store.cards()[0]?.year).toBe(2024);
    });

    it('draws each card on the breakdown chosen for its indicator', async () => {
      const store = setup();
      await store.load();
      await store.toggle('tenure');
      store.select('ES');

      store.setBreakdown('overburden', 'youth');

      expect(store.cards().map((card) => [card.breakdown, card.headline?.value])).toEqual([
        ['youth', 7.2],
        ['total', 24.7],
      ]);
      expect(store.meta()?.id).toBe('tenure');
      expect(store.breakdown()).toBe('total');
    });
  });

  describe('year', () => {
    const recent: IndicatorMeta = { ...overburden, id: 'recent', years: [2020, 2025] };
    const early: IndicatorMeta = { ...overburden, id: 'early', years: [2015, 2023] };

    async function withRanges() {
      const store = setup({
        catalog: () => Promise.resolve([recent, early]),
        data: () => Promise.resolve(data),
      });
      await store.load();
      return store;
    }

    it('offers the years of the active indicators, newest first', async () => {
      const store = await withRanges();
      expect(store.years()).toEqual([2025, 2024, 2023, 2022, 2021, 2020]);

      await store.toggle('early');
      expect(store.years().at(-1)).toBe(2015);
    });

    it('ignores years outside that range', async () => {
      const store = await withRanges();
      store.setYear(2016);
      expect(store.year()).toBe(2025);

      store.setYear(2021);
      expect(store.year()).toBe(2021);
    });

    it('brings the year back into range when an indicator is switched off', async () => {
      const store = await withRanges();
      await store.toggle('early');
      store.setYear(2016);

      await store.toggle('early');

      expect(store.year()).toBe(2020);
    });
  });

  describe('URL', () => {
    /** The query last written, once the effects have run. */
    const written = (store: ReturnType<typeof setup>) => {
      TestBed.tick();
      return store.urlPort.write.calls.mostRecent()?.args[0] as QueryParams | undefined;
    };

    it('opens the state the URL describes', async () => {
      const store = setup(
        {},
        {
          ind: 'tenure,overburden',
          main: 'tenure',
          geo: 'ES',
          year: '2020',
          bd: 'overburden:youth',
        },
      );
      await store.load();

      expect(store.active()).toEqual(['tenure', 'overburden']);
      expect(store.meta()?.id).toBe('tenure');
      expect(store.selected()).toBe('ES');
      expect(store.year()).toBe(2020);
      expect(store.cards().map((card) => card.breakdown)).toEqual(['total', 'youth']);
    });

    it('opens an invalid URL on the nearest valid state, and writes that one back', async () => {
      const store = setup({}, { ind: 'hpi', geo: 'XX', year: '1990', level: '3' });
      await store.load();

      expect(store.active()).toEqual(['overburden']);
      expect(written(store)).toEqual({
        ind: 'overburden',
        main: 'overburden',
        year: '2015',
        level: '0',
      });
    });

    it('writes every change to the URL', async () => {
      const store = setup();
      await store.load();

      await store.toggle('tenure');
      store.select('ES');
      store.setBreakdown('overburden', 'youth');
      store.setYear(2020);

      expect(written(store)).toEqual({
        ind: 'overburden,tenure',
        main: 'tenure',
        geo: 'ES',
        year: '2020',
        level: '0',
        bd: 'overburden:youth',
      });
    });

    it('leaves out of the URL the breakdowns set back to the first one', async () => {
      const store = setup();
      await store.load();
      store.setBreakdown('overburden', 'youth');
      store.setBreakdown('overburden', 'total');

      expect(written(store)?.['bd']).toBeUndefined();
    });

    it('drops the indicators whose data fails to load', async () => {
      const store = setup(
        {
          data: (id) =>
            id === 'tenure' ? Promise.reject(new Error('404')) : Promise.resolve(data),
        },
        { ind: 'overburden,tenure' },
      );
      await store.load();

      expect(store.active()).toEqual(['overburden']);
      expect(store.failed().has('tenure')).toBeTrue();
    });

    it('does not touch the URL when the data cannot be loaded', async () => {
      const store = setup({ catalog: () => Promise.reject(new Error('404')) });
      await store.load();

      expect(written(store)).toBeUndefined();
    });
  });

  describe('NUTS 2', () => {
    const unemployment: IndicatorMeta = {
      ...overburden,
      id: 'unemployment',
      label: 'Tasa de paro',
      theme: 'context',
      levels: [0, 2],
      breakdowns: [{ id: 'total', label: 'Total' }],
      breaks: { total: [5, 10] },
    };
    const regionalData: IndicatorData = {
      ES: { '2024': { total: { v: 11 } } },
      ES30: { '2024': { total: { v: 9 } } },
      ES51: { '2024': { total: { v: 8.5 } } },
      PT17: { '2024': { total: { v: 6.4 } } },
      EU27_2020: { '2024': { total: { v: 6 } } },
    };

    /** Overburden (national) and unemployment (regional, on the map). */
    function withRegional(query: QueryParams = { ind: 'overburden,unemployment' }) {
      return setup(
        {
          catalog: () => Promise.resolve([overburden, unemployment]),
          data: (id) => Promise.resolve(id === 'unemployment' ? regionalData : data),
        },
        query,
      );
    }

    it('shows the regions of a regional indicator', async () => {
      const store = withRegional();
      await store.load();

      await store.setLevel(2);

      expect(store.level()).toBe(2);
      expect(store.geography()).toBe(regional);
      expect(store.values().map((entry) => [entry.geo, entry.value])).toEqual([
        ['ES30', 9],
        ['ES51', 8.5],
        ['PT17', 6.4],
      ]);
    });

    it('keeps national indicators by country, on the country of the region selected', async () => {
      const store = withRegional();
      await store.load();
      await store.setLevel(2);

      store.select('ES30');

      const [national, regionalCard] = store.cards();
      expect(national?.values.map((entry) => entry.geo)).toEqual(['ES', 'PT']);
      expect(national?.selected).toBe('ES');
      expect(national?.headline?.value).toBe(7.8);
      expect(regionalCard?.selected).toBe('ES30');
      expect(regionalCard?.headline?.value).toBe(9);
    });

    it('offers no regions for a national indicator on the map', async () => {
      const store = setup();
      await store.load();

      expect(store.canShowRegions()).toBeFalse();
      await store.setLevel(2);

      expect(store.level()).toBe(0);
      expect(store.nuts2).not.toHaveBeenCalled();
    });

    it('takes the map back to the countries when a national indicator becomes the main one', async () => {
      const store = withRegional();
      await store.load();
      await store.setLevel(2);
      store.select('ES30');

      store.setMain('overburden');

      expect(store.level()).toBe(0);
      expect(store.selected()).toBeUndefined();
    });

    it('names the regions from their geometry, and the cards get the names', async () => {
      const store = withRegional();
      await store.load();
      expect(store.names()['ES30']).toBeUndefined();

      await store.setLevel(2);

      expect(store.names()['ES30']).toBe('Comunidad de Madrid');
      expect(store.cards()[1]?.names['ES51']).toBe('Cataluña');
    });

    it('loads the NUTS 2 geometry once, and goes back to the countries', async () => {
      const store = withRegional();
      await store.load();

      await store.setLevel(2);
      await store.setLevel(0);
      await store.setLevel(2);

      expect(store.nuts2).toHaveBeenCalledTimes(1);
      await store.setLevel(0);
      expect(store.geography()).toBe(geography);
      expect(store.values().map((entry) => entry.geo)).toEqual(['ES']);
    });

    it('clears the selection when the level changes', async () => {
      const store = withRegional();
      await store.load();
      store.select('ES');

      await store.setLevel(2);

      expect(store.selected()).toBeUndefined();
    });

    it('opens a URL at NUTS 2 with its region, and keeps the level in the URL', async () => {
      const store = withRegional({ ind: 'unemployment', level: '2', geo: 'ES51' });
      await store.load();

      expect(store.level()).toBe(2);
      expect(store.selected()).toBe('ES51');
      TestBed.tick();
      expect(store.urlPort.write.calls.mostRecent()?.args[0]).toEqual(
        jasmine.objectContaining({ level: '2', geo: 'ES51' }),
      );
    });

    it('opens a URL at NUTS 2 of a national indicator on the countries', async () => {
      const store = withRegional({ ind: 'overburden', level: '2', geo: 'ES51' });
      await store.load();

      expect(store.level()).toBe(0);
      expect(store.selected()).toBeUndefined();
    });
  });

  describe('scatter', () => {
    const emancipation: IndicatorMeta = {
      ...overburden,
      id: 'emancipation',
      label: 'Edad media de emancipación',
      breakdowns: [{ id: 'total', label: 'Total' }],
      breaks: { total: [25, 28] },
      years: [2015, 2023],
    };
    const hpi: IndicatorMeta = {
      ...overburden,
      id: 'hpi',
      label: 'Variación del precio de la vivienda',
      kind: 'index',
      breakdowns: [{ id: 'total', label: 'Total' }],
      breaks: { total: [0, 50] },
    };
    const byIndicator: Record<string, IndicatorData> = {
      overburden: {
        ES: { '2024': { total: { v: 7.8 }, youth: { v: 12 } } },
        PT: { '2024': { total: { v: 5.1 }, youth: { v: 9 } } },
        FR: { '2024': { total: { v: 4.9 }, youth: { v: 10 } } },
      },
      emancipation: {
        ES: { '2023': { total: { v: 30 } } },
        PT: { '2023': { total: { v: 29 } } },
        FR: { '2023': { total: { v: 24 } } },
      },
      hpi: {
        ES: { '2024': { total: { v: 150 } } },
        PT: { '2024': { total: { v: 190 } } },
      },
    };

    function withScatter(ind: string) {
      return setup(
        {
          catalog: () => Promise.resolve([overburden, emancipation, hpi, tenure]),
          data: (id) => Promise.resolve(byIndicator[id] ?? tenureData),
        },
        { ind },
      );
    }

    it('appears only with two numeric indicators active', async () => {
      const store = withScatter('overburden,tenure');
      await store.load();
      expect(store.scatter()).toBeUndefined();
    });

    it('opens on a suggested pair, with its points, r and years', async () => {
      const store = withScatter('overburden,emancipation');
      await store.load();

      const scatter = store.scatter();
      expect(scatter?.pair).toEqual({
        x: { id: 'emancipation', breakdown: 'total' },
        y: { id: 'overburden', breakdown: 'youth' },
      });
      expect(scatter?.label).toBe(
        'Sobrecarga por coste de vivienda (Jóvenes (20–29 años)) frente a Edad media de emancipación',
      );
      expect(scatter?.points.map((point) => [point.geo, point.x, point.y])).toEqual([
        ['ES', 30, 12],
        ['FR', 24, 10],
        ['PT', 29, 9],
      ]);
      expect(scatter?.r).toBeCloseTo(0.3, 1);
      expect([scatter?.x.year, scatter?.y.year]).toEqual([2023, 2024]);
    });

    it('puts the last two numeric indicators when no pair is suggested', async () => {
      const store = withScatter('hpi,overburden');
      await store.load();

      expect(store.scatter()?.pair).toEqual({
        x: { id: 'hpi', breakdown: 'total' },
        y: { id: 'overburden', breakdown: 'total' },
      });
      expect(store.scatter()?.r).toBeUndefined();
    });

    it('lets the user choose the axes among the numeric active indicators', async () => {
      const store = withScatter('overburden,emancipation,hpi');
      await store.load();
      const chosen = {
        x: { id: 'hpi', breakdown: 'total' },
        y: { id: 'emancipation', breakdown: 'total' },
      };

      store.setScatterPair(chosen);
      expect(store.scatter()?.pair).toEqual(chosen);

      store.setScatterPair({ x: { id: 'tenure', breakdown: 'total' }, y: chosen.y });
      expect(store.scatter()?.pair).toEqual(chosen);
    });
  });
});
