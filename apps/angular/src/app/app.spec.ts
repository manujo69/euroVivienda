import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { Catalog, IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import { App } from './app';
import { ExplorerStore } from './application/explorer.store';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY } from './application/tokens';
import type { MapGeography } from './domain/ports';

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
  notes:
    'Población que vive en hogares que dedican más del 40 % de su renta disponible a la vivienda.',
};

const data: IndicatorData = {
  ES: { '2024': { total: { v: 7.8 }, youth: { v: 12.4, f: 'p' } } },
  PT: { '2024': { total: { v: 5.1, f: 'p', n: 'Muestra pequeña.' } } },
  EU27_2020: { '2024': { total: { v: 8.2 } } },
};

const empty = { type: 'FeatureCollection' as const, features: [] };
const geography: MapGeography = { regions: empty, context: empty };

describe('App', () => {
  let fixture: ComponentFixture<App>;

  async function render() {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: INDICATOR_REPOSITORY,
          useValue: {
            catalog: () => Promise.resolve([overburden] as Catalog),
            data: () => Promise.resolve(data),
          },
        },
        { provide: GEOGRAPHY_REPOSITORY, useValue: { nuts0: () => Promise.resolve(geography) } },
      ],
    });
    fixture = TestBed.createComponent(App);
    await TestBed.inject(ExplorerStore).load();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('titles the screen with the main indicator and the year shown', async () => {
    const page = await render();
    expect(page.querySelector('h1')?.textContent).toContain('Sobrecarga por coste de vivienda');
    expect(page.textContent).toContain('2024');
    expect(page.textContent).toContain('Media UE');
  });

  it('explains the indicator under its title, with the note from the catalogue', async () => {
    const page = await render();
    expect(page.querySelector('h1 + .subtitle')?.textContent?.trim()).toBe(
      'Población que vive en hogares que dedican más del 40 % de su renta disponible a la vivienda.',
    );
  });

  it('lists the countries in an accessible table, highest value first', async () => {
    const page = await render();
    const rows = [...page.querySelectorAll('table tbody tr')].map((row) => row.textContent ?? '');
    expect(page.querySelector('table caption')).not.toBeNull();
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('España');
    expect(rows[0]).toContain('7,8 %');
    expect(rows[1]).toContain('5,1 %');
  });

  it('selects a country from the table', async () => {
    const page = await render();
    const button = page.querySelector<HTMLButtonElement>('table tbody button');
    button?.click();
    expect(TestBed.inject(ExplorerStore).selected()).toBe('ES');
  });

  it('shows flags and the note of each value in the table', async () => {
    const page = await render();
    const notes = [...page.querySelectorAll('table tbody td.notes')].map((cell) =>
      cell.textContent?.trim(),
    );
    expect(notes).toEqual(['', 'Provisional. Muestra pequeña.']);
  });

  it('shows the catalogue beside the map, with the main indicator active', async () => {
    const page = await render();
    const catalogue = page.querySelector('aside app-catalog');
    expect(catalogue?.textContent).toContain('Acceso');
    expect(
      catalogue?.querySelector<HTMLInputElement>('input:checked')?.parentElement?.textContent,
    ).toContain('Sobrecarga por coste de vivienda');
  });

  it('shows a card per active indicator in the panel beside the map', async () => {
    const page = await render();
    const cards = [...page.querySelectorAll('aside app-panel app-card h3')];
    expect(cards.map((title) => title.textContent?.trim())).toEqual([
      'Sobrecarga por coste de vivienda',
    ]);
  });

  it('asks for an indicator when none is active', async () => {
    const page = await render();
    page.querySelector<HTMLInputElement>('app-catalog input:checked')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.querySelector('main')?.textContent).toContain('Activa un indicador en el catálogo');
  });

  it('warns that the outermost regions are not drawn', async () => {
    const page = await render();
    expect(page.textContent).toContain('ultraperiféricas');
  });
});
