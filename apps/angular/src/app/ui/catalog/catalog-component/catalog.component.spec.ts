import { TestBed } from '@angular/core/testing';
import type { Catalog, IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import { ExplorerStore } from '../../../application/explorer.store';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY } from '../../../application/tokens';
import type { IndicatorRepository, MapGeography } from '../../../domain/ports';
import { CatalogComponent } from './catalog.component';

const indicator = (id: string, label: string, theme: IndicatorMeta['theme']): IndicatorMeta => ({
  id,
  label,
  theme,
  kind: 'scalar',
  unit: '%',
  levels: [0],
  years: [2015, 2025],
  source: { name: 'Eurostat', code: id, url: 'https://example.test', lastUpdate: '2026-09-17' },
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [5, 8] },
});

const catalog: Catalog = [
  indicator('overburden', 'Sobrecarga por coste de vivienda', 'access'),
  indicator('hpi', 'Variación del precio de la vivienda', 'prices'),
  indicator('tenure', 'Régimen de tenencia', 'access'),
];

const data: IndicatorData = { ES: { '2024': { total: { v: 7.8 } } } };
const empty = { type: 'FeatureCollection' as const, features: [] };
const geography: MapGeography = { regions: empty, context: empty };

describe('CatalogComponent', () => {
  async function render(indicators: Partial<IndicatorRepository> = {}) {
    TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        {
          provide: INDICATOR_REPOSITORY,
          useValue: {
            catalog: () => Promise.resolve(catalog),
            data: () => Promise.resolve(data),
            ...indicators,
          },
        },
        { provide: GEOGRAPHY_REPOSITORY, useValue: { nuts0: () => Promise.resolve(geography) } },
      ],
    });
    const store = TestBed.inject(ExplorerStore);
    await store.load();
    const fixture = TestBed.createComponent(CatalogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const checkbox = (label: string) =>
      [...element.querySelectorAll('label')]
        .find((item) => item.textContent?.includes(label))
        ?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    /** Clicks a checkbox and waits for the store to load its data. */
    const click = async (label: string) => {
      checkbox(label)?.click();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const mapButtons = () =>
      [...element.querySelectorAll<HTMLButtonElement>('button')].map((button) => ({
        name: button.getAttribute('aria-label'),
        pressed: button.getAttribute('aria-pressed'),
        button,
      }));
    return { fixture, store, element, checkbox, click, mapButtons };
  }

  it('groups the indicators by theme, in the order of the catalogue themes', async () => {
    const { element } = await render();
    const groups = [...element.querySelectorAll('fieldset')].map((group) => [
      group.querySelector('legend')?.textContent?.trim(),
      [...group.querySelectorAll('label')].map((label) => label.textContent?.trim()),
    ]);
    expect(groups).toEqual([
      ['Precios', ['Variación del precio de la vivienda']],
      ['Acceso', ['Sobrecarga por coste de vivienda', 'Régimen de tenencia']],
    ]);
  });

  it('checks the active indicators', async () => {
    const { checkbox } = await render();
    expect(checkbox('Sobrecarga')?.checked).toBeTrue();
    expect(checkbox('Régimen')?.checked).toBeFalse();
  });

  it('activates an indicator when its box is checked', async () => {
    const { store, checkbox, click } = await render();
    await click('Régimen');
    expect(store.active()).toEqual(['overburden', 'tenure']);
    expect(checkbox('Régimen')?.checked).toBeTrue();
  });

  it('deactivates an indicator when its box is unchecked', async () => {
    const { store, checkbox, click } = await render();
    await click('Sobrecarga');
    expect(store.active()).toEqual([]);
    expect(checkbox('Sobrecarga')?.checked).toBeFalse();
  });

  it('says so when an indicator cannot be loaded, and leaves it unchecked', async () => {
    const { element, checkbox, click } = await render({
      data: (id) => (id === 'tenure' ? Promise.reject(new Error('404')) : Promise.resolve(data)),
    });
    await click('Régimen');
    expect(checkbox('Régimen')?.checked).toBeFalse();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar los datos de Régimen de tenencia',
    );
  });

  it('offers to show on the map only the active indicators, pressed on the main one', async () => {
    const { click, mapButtons } = await render();
    await click('Régimen');
    expect(mapButtons().map(({ name, pressed }) => [name, pressed])).toEqual([
      ['Ver Sobrecarga por coste de vivienda en el mapa', 'false'],
      ['Ver Régimen de tenencia en el mapa', 'true'],
    ]);
  });

  it('puts an active indicator on the map with its button', async () => {
    const { fixture, store, click, mapButtons } = await render();
    await click('Régimen');

    mapButtons()[0]?.button.click();
    fixture.detectChanges();

    expect(store.meta()?.id).toBe('overburden');
    expect(mapButtons().map(({ pressed }) => pressed)).toEqual(['true', 'false']);
  });
});
