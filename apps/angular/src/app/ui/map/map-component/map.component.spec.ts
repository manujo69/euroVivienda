import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { Catalog, IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ExplorerStore } from '../../../application/explorer.store';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY, URL_STATE } from '../../../application/tokens';
import type { Geography, MapGeography } from '../../../domain/ports';
import { MapComponent } from './map.component';

const overburden: IndicatorMeta = {
  id: 'overburden',
  label: 'Sobrecarga por coste de vivienda',
  theme: 'access',
  kind: 'scalar',
  unit: '%',
  // Regional, so the map can go down to NUTS 2.
  levels: [0, 2],
  years: [2015, 2025],
  source: {
    name: 'Eurostat',
    code: 'ilc_lvho07a',
    url: 'https://example.test',
    lastUpdate: '2026-09-17',
  },
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [5, 8] },
};

const data: IndicatorData = {
  ES: { '2024': { total: { v: 7.8 } } },
  PT: { '2024': { total: { v: 5.1 } } },
  ES30: { '2024': { total: { v: 9.1 } } },
  ES51: { '2024': { total: { v: 6.2 } } },
};

/** A unit square per code, enough for ECharts to frame the map. */
function layer(...codes: string[]): Geography {
  return {
    type: 'FeatureCollection',
    features: codes.map((code, i) => ({
      type: 'Feature',
      properties: { code },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [i, 0],
            [i + 1, 0],
            [i + 1, 1],
            [i, 1],
            [i, 0],
          ],
        ],
      },
    })),
  };
}

const drawn: MapGeography = { regions: layer('ES', 'PT'), context: layer('CH') };
const blank: MapGeography = { regions: layer(), context: layer() };

/** Madrid and Cataluña, named as in geo/nuts2.json. */
const regional: MapGeography = {
  regions: {
    type: 'FeatureCollection',
    features: layer('ES30', 'ES51').features.map((feature, i) => ({
      ...feature,
      properties: { ...feature.properties, name: ['Comunidad de Madrid', 'Cataluña'][i] },
    })),
  },
  context: layer('CH'),
};

describe('MapComponent', () => {
  async function render(geography: MapGeography = drawn) {
    TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        {
          provide: INDICATOR_REPOSITORY,
          useValue: {
            catalog: () => Promise.resolve([overburden] as Catalog),
            data: () => Promise.resolve(data),
          },
        },
        {
          provide: GEOGRAPHY_REPOSITORY,
          useValue: {
            nuts0: () => Promise.resolve(geography),
            nuts2: () => Promise.resolve(regional),
          },
        },
        {
          provide: URL_STATE,
          useValue: { read: () => Promise.resolve({}), write: () => Promise.resolve() },
        },
      ],
    });
    const store = TestBed.inject(ExplorerStore);
    await store.load();
    const fixture = TestBed.createComponent(MapComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const chart = fixture.debugElement.query(By.directive(NgxEchartsDirective));
    return {
      fixture,
      store,
      chart,
      options: () => chart.injector.get(NgxEchartsDirective).options() as Record<string, unknown>,
      map: fixture.nativeElement as HTMLElement,
    };
  }

  it('describes the map by its indicator and points to the table', async () => {
    const { chart } = await render();
    const element = chart.nativeElement as HTMLElement;
    expect(element.getAttribute('role')).toBe('img');
    expect(element.getAttribute('aria-label')).toBe(
      'Mapa de Sobrecarga por coste de vivienda. Los datos están en la tabla.',
    );
  });

  it('draws the regions and their context as one map', async () => {
    const { options } = await render();
    const [series] = options()['series'] as { map: string; data: { name: string }[] }[];
    expect(series?.map).toBe('nuts0');
    expect(series?.data.map((item) => item.name).sort()).toEqual(['CH', 'ES', 'PT']);
  });

  it('passes no option while there are no geometries to frame', async () => {
    const { options } = await render(blank);
    expect(options()).toEqual({});
  });

  it('lists one legend entry per class, plus the entry for missing data', async () => {
    const { map } = await render();
    const items = [...map.querySelectorAll('.legend li')].map((item) => item.textContent?.trim());
    expect(items).toEqual(['Menos de 5', '5–8', '8 o más', 'Sin dato']);
  });

  it('selects a region clicked on the map', async () => {
    const { store, chart } = await render();
    chart.triggerEventHandler('chartClick', { name: 'PT' });
    expect(store.selected()).toBe('PT');
  });

  it('ignores clicks on the non-EU context', async () => {
    const { store, chart } = await render();
    chart.triggerEventHandler('chartClick', { name: 'CH' });
    expect(store.selected()).toBeUndefined();
  });

  describe('at NUTS 2', () => {
    async function atNuts2() {
      const rendered = await render();
      await rendered.store.setLevel(2);
      rendered.fixture.detectChanges();
      return rendered;
    }

    it('draws the regions, each named, on the NUTS 2 map', async () => {
      const { options } = await atNuts2();
      const [series] = options()['series'] as { map: string; data: { name: string }[] }[];
      expect(series?.map).toBe('nuts2');
      expect(series?.data.map((item) => item.name).sort()).toEqual(['CH', 'ES30', 'ES51']);
      const tooltip = (options()['tooltip'] as { formatter: (p: { name: string }) => string })
        .formatter;
      expect(tooltip({ name: 'ES30' })).toContain('Comunidad de Madrid');
    });
  });
});
