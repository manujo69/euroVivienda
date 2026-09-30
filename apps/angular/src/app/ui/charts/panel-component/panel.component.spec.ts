import { TestBed } from '@angular/core/testing';
import type { Catalog, IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import { ExplorerStore } from '../../../application/explorer.store';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY } from '../../../application/tokens';
import type { MapGeography } from '../../../domain/ports';
import { By } from '@angular/platform-browser';
import { CardComponent } from '../card-component/card.component';
import { PanelComponent } from './panel.component';

const indicator = (id: string): IndicatorMeta => ({
  id,
  label: `Indicador ${id}`,
  theme: 'access',
  kind: 'scalar',
  unit: '%',
  levels: [0],
  years: [2015, 2025],
  source: { name: 'Eurostat', code: id, url: 'https://example.test', lastUpdate: '2026-09-17' },
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [5, 8] },
});

const catalog: Catalog = ['a', 'b', 'c', 'd', 'e'].map(indicator);
const data: IndicatorData = { EU27_2020: { '2024': { total: { v: 8.2 } } } };
const empty = { type: 'FeatureCollection' as const, features: [] };
const geography: MapGeography = { regions: empty, context: empty };

describe('PanelComponent', () => {
  async function render(active: readonly string[]) {
    TestBed.configureTestingModule({
      imports: [PanelComponent],
      providers: [
        {
          provide: INDICATOR_REPOSITORY,
          useValue: { catalog: () => Promise.resolve(catalog), data: () => Promise.resolve(data) },
        },
        { provide: GEOGRAPHY_REPOSITORY, useValue: { nuts0: () => Promise.resolve(geography) } },
      ],
    });
    const store = TestBed.inject(ExplorerStore);
    await store.load();
    for (const id of active) await store.toggle(id);
    const fixture = TestBed.createComponent(PanelComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const cards = () =>
      [...element.querySelectorAll('app-card')].map((card) => [
        card.querySelector('h3')?.textContent?.trim(),
        card.querySelector('button') ? 'folded' : 'open',
      ]);
    return { fixture, store, element, cards };
  }

  it('heads the panel as the active indicators', async () => {
    const { element } = await render([]);
    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Indicadores activos');
  });

  it('shows a card per active indicator, folding the oldest beyond four', async () => {
    const { cards } = await render(['b', 'c', 'd', 'e']);
    expect(cards()).toEqual([
      ['Indicador a', 'folded'],
      ['Indicador b', 'open'],
      ['Indicador c', 'open'],
      ['Indicador d', 'open'],
      ['Indicador e', 'open'],
    ]);
  });

  it('opens a folded card, folding the one used least recently', async () => {
    const { fixture, element, cards } = await render(['b', 'c', 'd', 'e']);

    element.querySelector<HTMLButtonElement>('app-card button')?.click();
    fixture.detectChanges();

    expect(cards().map(([, state]) => state)).toEqual(['open', 'folded', 'open', 'open', 'open']);
  });

  it('asks for an indicator when none is active', async () => {
    const { fixture, store, element } = await render([]);
    await store.toggle('a');
    fixture.detectChanges();
    expect(element.textContent).toContain(
      'Activa indicadores en el catálogo para ver sus gráficos.',
    );
  });

  it('selects the region a card picks, as the map and the table do', async () => {
    const { fixture, store } = await render([]);
    const card = fixture.debugElement.query(By.directive(CardComponent));

    (card.componentInstance as CardComponent).regionPicked.emit('ES');
    expect(store.selected()).toBe('ES');

    (card.componentInstance as CardComponent).regionPicked.emit('ES');
    expect(store.selected()).toBeUndefined();
  });

  it('sets the breakdown a card asks for, on its indicator', async () => {
    const { fixture, store } = await render(['b']);
    const [, second] = fixture.debugElement.queryAll(By.directive(CardComponent));
    const spy = spyOn(store, 'setBreakdown');

    (second?.componentInstance as CardComponent).breakdownChosen.emit('total');

    expect(spy).toHaveBeenCalledWith('b', 'total');
  });
});
