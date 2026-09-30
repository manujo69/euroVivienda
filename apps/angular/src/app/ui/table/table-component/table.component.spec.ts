import { TestBed } from '@angular/core/testing';
import type { Catalog, IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import { ExplorerStore } from '../../../application/explorer.store';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY, URL_STATE } from '../../../application/tokens';
import type { MapGeography } from '../../../domain/ports';
import { TableComponent } from './table.component';

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
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [5, 8] },
};

const withEu: IndicatorData = {
  ES: { '2024': { total: { v: 7.8 } } },
  PT: { '2024': { total: { v: 5, f: 'p', n: 'Muestra pequeña.' } } },
  DE: { '2024': { total: { v: 9, n: 'dato revisado.' } } },
  EU27_2020: { '2024': { total: { v: 8 } } },
};

const empty = { type: 'FeatureCollection' as const, features: [] };
const geography: MapGeography = { regions: empty, context: empty };

describe('TableComponent', () => {
  async function render(data: IndicatorData = withEu) {
    TestBed.configureTestingModule({
      imports: [TableComponent],
      providers: [
        {
          provide: INDICATOR_REPOSITORY,
          useValue: {
            catalog: () => Promise.resolve([overburden] as Catalog),
            data: () => Promise.resolve(data),
          },
        },
        { provide: GEOGRAPHY_REPOSITORY, useValue: { nuts0: () => Promise.resolve(geography) } },
        {
          provide: URL_STATE,
          useValue: { read: () => Promise.resolve({}), write: () => Promise.resolve() },
        },
      ],
    });
    const store = TestBed.inject(ExplorerStore);
    await store.load();
    const fixture = TestBed.createComponent(TableComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, store, table: fixture.nativeElement as HTMLElement };
  }

  const cells = (row: Element) =>
    [...row.querySelectorAll('td, th')].map((cell) => cell.textContent?.trim());

  it('names the year shown in the caption', async () => {
    const { table } = await render();
    expect(table.querySelector('caption')?.textContent).toContain('2024');
  });

  it('ranks the countries from the highest value down', async () => {
    const { table } = await render();
    const rows = [...table.querySelectorAll('tbody tr')].map(cells);
    expect(rows.map((row) => row.slice(0, 2))).toEqual([
      ['1', 'Alemania'],
      ['2', 'España'],
      ['3', 'Portugal'],
    ]);
  });

  it('gives every figure, EU mean included, the same decimals', async () => {
    const { table } = await render();
    const figures = [...table.querySelectorAll('td.number:not(:first-child)')].map((cell) =>
      cell.textContent?.trim(),
    );
    expect(figures).toEqual(['9,0 %', '7,8 %', '5,0 %', '8,0 %']);
  });

  it('shows the EU mean in the footer', async () => {
    const { table } = await render();
    const footer = table.querySelector('tfoot tr');
    expect(footer && cells(footer)).toEqual(['', 'Media UE', '8,0 %', '']);
  });

  it('leaves the footer out when there is no EU mean', async () => {
    const countries = Object.fromEntries(
      Object.entries(withEu).filter(([geo]) => geo !== 'EU27_2020'),
    ) as IndicatorData;
    const { table } = await render(countries);
    expect(table.querySelector('tfoot')).toBeNull();
  });

  it('joins flags and note into one sentence-case text', async () => {
    const { table } = await render();
    const notes = [...table.querySelectorAll('tbody td.notes')].map((cell) =>
      cell.textContent?.trim(),
    );
    expect(notes).toEqual(['Dato revisado.', '', 'Provisional. Muestra pequeña.']);
  });

  it('selects a country with its button and marks its row', async () => {
    const { fixture, store, table } = await render();
    const button = table.querySelectorAll<HTMLButtonElement>('tbody button')[1];
    button?.click();
    fixture.detectChanges();
    expect(store.selected()).toBe('ES');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(table.querySelector('tr.selected')?.textContent).toContain('España');
  });

  it('clears the selection when the selected country is clicked again', async () => {
    const { fixture, store, table } = await render();
    const button = table.querySelector<HTMLButtonElement>('tbody button');
    button?.click();
    button?.click();
    fixture.detectChanges();
    expect(store.selected()).toBeUndefined();
    expect(table.querySelector('tr.selected')).toBeNull();
  });
});
