import { DeferBlockState, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { IndicatorData } from '@eurovivienda/contract';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { IndicatorMeta } from '@eurovivienda/contract';
import type { Card } from '../../../application/explorer.store';
import { ChartComponent } from '../chart-component/chart.component';
import { RankingComponent } from '../ranking-component/ranking.component';
import { CardComponent } from './card.component';

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

const series: IndicatorData = {
  ES: { '2015': { total: { v: 9.1 } }, '2016': { total: { v: 8.4 } } },
  EU27_2020: { '2015': { total: { v: 9.9 } }, '2016': { total: { v: 9.5 } } },
};

const card = (extra: Partial<Card> = {}): Card => ({
  meta: overburden,
  open: true,
  year: 2024,
  headline: { geo: 'EU27_2020', value: 8.2, flags: undefined },
  breakdown: 'total',
  data: {},
  values: [],
  eu: { geo: 'EU27_2020', value: 8.2, flags: undefined },
  selected: undefined,
  names: {},
  ...extra,
});

describe('CardComponent', () => {
  /** Renders the card with its deferred charts loaded, whatever order the tests run in. */
  async function render(value: Card) {
    const fixture = TestBed.createComponent(CardComponent);
    fixture.componentRef.setInput('card', value);
    fixture.detectChanges();
    for (const block of await fixture.getDeferBlocks())
      await block.render(DeferBlockState.Complete);
    const picked = jasmine.createSpy('regionPicked');
    fixture.componentInstance.regionPicked.subscribe(picked);
    const chosen = jasmine.createSpy('breakdownChosen');
    fixture.componentInstance.breakdownChosen.subscribe(chosen);
    return { fixture, element: fixture.nativeElement as HTMLElement, picked, chosen };
  }

  const text = (element: HTMLElement, selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  it('titles the card with the indicator from the catalogue', async () => {
    const { element } = await render(card());
    expect(text(element, 'h3')).toBe('Sobrecarga por coste de vivienda');
  });

  it('leads with the figure, its unit and a sentence that explains it', async () => {
    const { element } = await render(card());
    expect(text(element, '.headline .figure')).toBe('8,2 %');
    expect(text(element, '.headline .explanation')).toBe('Media UE en 2024');
  });

  it('names the selected region and spells out its flags', async () => {
    const { element } = await render(card({ headline: { geo: 'PT', value: 5.1, flags: 'p' } }));
    expect(text(element, '.headline .explanation')).toBe('Portugal en 2024');
    expect(text(element, '.headline sup [aria-hidden="true"]')).toBe('p');
    expect(text(element, '.headline sup .visually-hidden')).toBe('provisional');
  });

  it('names a selected region by its name', async () => {
    const { element } = await render(
      card({
        headline: { geo: 'ES30', value: 9.1, flags: undefined },
        names: { ES30: 'Comunidad de Madrid' },
      }),
    );
    expect(text(element, '.headline .explanation')).toBe('Comunidad de Madrid en 2024');
  });

  it('says so when there is no figure to show', async () => {
    const { element } = await render(card({ headline: undefined }));
    expect(text(element, '.headline')).toBe('Sin dato');
  });

  describe('breakdown', () => {
    const withBreakdowns: IndicatorMeta = {
      ...overburden,
      breakdowns: [
        { id: 'total', label: 'Toda la población' },
        { id: 'youth', label: 'Jóvenes de 20 a 29 años' },
      ],
    };
    const selector = (element: HTMLElement) =>
      [...element.querySelectorAll('label')]
        .find((label) => label.textContent?.includes('Desglose'))
        ?.querySelector('select');

    it('offers the breakdowns of the indicator, on the one chosen', async () => {
      const { element } = await render(card({ meta: withBreakdowns, breakdown: 'youth' }));
      const select = selector(element);
      expect([...(select?.options ?? [])].map((option) => option.text.trim())).toEqual([
        'Toda la población',
        'Jóvenes de 20 a 29 años',
      ]);
      expect(select?.value).toBe('youth');
    });

    it('asks for the breakdown chosen', async () => {
      const { element, chosen } = await render(card({ meta: withBreakdowns }));
      const select = selector(element);
      if (select) select.value = 'youth';
      select?.dispatchEvent(new Event('change'));
      expect(chosen).toHaveBeenCalledWith('youth');
    });

    it('offers no choice with a single breakdown, nor while folded', async () => {
      expect(selector((await render(card())).element)).toBeUndefined();
      expect(
        selector((await render(card({ meta: withBreakdowns, open: false }))).element),
      ).toBeUndefined();
    });
  });

  it('offers no button to open a card that is already open', async () => {
    const { element } = await render(card());
    expect(element.querySelector('button')).toBeNull();
  });

  it('asks to be opened when folded', async () => {
    const { fixture, element } = await render(card({ open: false }));
    const opened = jasmine.createSpy('opened');
    fixture.componentInstance.opened.subscribe(opened);

    const button = element.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-label')).toBe('Abrir Sobrecarga por coste de vivienda');
    button?.click();

    expect(opened).toHaveBeenCalled();
  });

  describe('scalar charts', () => {
    const lines = (fixture: Awaited<ReturnType<typeof render>>['fixture']) => {
      const chart = fixture.debugElement.query(By.directive(NgxEchartsDirective));
      const option = chart.injector.get(NgxEchartsDirective).options() as {
        series: { name: string; data: (number | null)[] }[];
      };
      return {
        label: (chart.nativeElement as HTMLElement).getAttribute('aria-label'),
        series: option.series.map((line) => [line.name, line.data]),
      };
    };

    it('shows the evolution of the EU mean and the ranking when open', async () => {
      const { fixture, element } = await render(card({ data: series }));
      const titles = [...element.querySelectorAll('h4')].map((title) => title.textContent?.trim());
      expect(titles).toEqual(['Evolución', 'Ranking 2024']);
      expect(lines(fixture)).toEqual({
        label: 'Evolución de Sobrecarga por coste de vivienda: media UE',
        series: [['Media UE', [9.9, 9.5]]],
      });
      expect(element.querySelector('app-ranking')).not.toBeNull();
    });

    it('draws the selected region against the EU mean', async () => {
      const { fixture } = await render(card({ data: series, selected: 'ES' }));
      expect(lines(fixture)).toEqual({
        label: 'Evolución de Sobrecarga por coste de vivienda: España frente a la media UE',
        series: [
          ['España', [9.1, 8.4]],
          ['Media UE', [9.9, 9.5]],
        ],
      });
    });

    it('selects a country from the ranking', async () => {
      const { fixture, picked } = await render(
        card({ data: series, values: [{ geo: 'ES', value: 7.8, flags: undefined }] }),
      );
      const ranking = fixture.debugElement.query(By.directive(RankingComponent));
      (ranking.componentInstance as RankingComponent).picked.emit('ES');
      expect(picked).toHaveBeenCalledWith('ES');
    });

    it('draws no charts while folded', async () => {
      const { element } = await render(card({ data: series, open: false }));
      expect(element.querySelector('app-chart')).toBeNull();
      expect(element.querySelector('app-ranking')).toBeNull();
    });

    it('marks derived indicators as own elaboration', async () => {
      const { element } = await render(card({ meta: { ...overburden, kind: 'derived' } }));
      expect(text(element, '.own')).toBe('Elaboración propia');
      expect(element.querySelector('app-chart')).not.toBeNull();
    });
  });

  describe('index charts', () => {
    const hpi: IndicatorMeta = {
      ...overburden,
      id: 'hpi',
      label: 'Variación del precio de la vivienda',
      kind: 'index',
      unit: 'Índice (2015 = 100)',
    };
    const indexData: IndicatorData = {
      EU27_2020: { '2015': { total: { v: 100 } }, '2016': { total: { v: 104.3 } } },
    };

    it('leads with the change since 2015, signed', async () => {
      const { element } = await render(card({ meta: hpi, data: indexData }));
      expect(text(element, '.headline .figure')).toBe('+8,2 %');
      expect(text(element, '.headline .explanation')).toBe('Media UE en 2024, desde 2015');
    });

    it('draws the index against the base year, without a ranking', async () => {
      const { fixture, element } = await render(card({ meta: hpi, data: indexData }));
      const chart = fixture.debugElement.query(By.directive(NgxEchartsDirective));
      const option = chart.injector.get(NgxEchartsDirective).options() as {
        series: { data: number[]; markLine?: { data: { yAxis: number }[] } }[];
      };
      expect(option.series.map((line) => line.data)).toEqual([[100, 104.3]]);
      expect(option.series[0]?.markLine?.data).toEqual([{ yAxis: 100 }]);
      expect(element.querySelector('app-ranking')).toBeNull();
    });
  });

  describe('composition charts', () => {
    const tenure: IndicatorMeta = {
      ...overburden,
      id: 'tenure',
      label: 'Régimen de tenencia',
      kind: 'composition',
      categories: [
        { id: 'own', label: 'Propietarios' },
        { id: 'rent_mkt', label: 'Inquilinos a precio de mercado' },
      ],
      mapCategory: { id: 'rent', label: 'Inquilinos (mercado y reducido)' },
    };
    const composition: IndicatorData = {
      ES: { '2024': { total: { v: { own: 75.3, rent_mkt: 15.9, rent: 24.7 } } } },
      PT: { '2024': { total: { v: { own: 70, rent_mkt: 20, rent: 30 } } } },
      EU27_2020: { '2024': { total: { v: { own: 69, rent_mkt: 21, rent: 31 } } } },
    };
    const tenureCard = (selected?: string) =>
      card({
        meta: tenure,
        data: composition,
        values: [
          { geo: 'ES', value: 24.7, flags: undefined },
          { geo: 'PT', value: 30, flags: undefined },
        ],
        eu: { geo: 'EU27_2020', value: 31, flags: undefined },
        headline: { geo: 'EU27_2020', value: 31, flags: undefined },
        selected,
      });
    const charts = (fixture: Awaited<ReturnType<typeof render>>['fixture']) =>
      fixture.debugElement.queryAll(By.directive(NgxEchartsDirective)).map((chart) => ({
        label: (chart.nativeElement as HTMLElement).getAttribute('aria-label'),
        option: chart.injector.get(NgxEchartsDirective).options() as {
          series: { name?: string; data: unknown[] }[];
          yAxis?: { data: string[] };
        },
      }));

    it('says which category the figure is', async () => {
      const { element } = await render(tenureCard());
      expect(text(element, '.headline .explanation')).toBe(
        'Media UE en 2024 · Inquilinos (mercado y reducido)',
      );
    });

    it('names each category once, with its colour and its share in the pie', async () => {
      const { element } = await render(tenureCard('ES'));
      const items = [...element.querySelectorAll('.categories li')].map((item) => [
        item.querySelector<HTMLElement>('.swatch')?.style.background,
        item.textContent?.replace(/\s+/g, ' ').trim(),
      ]);
      expect(items).toEqual([
        ['rgb(0, 114, 178)', 'Propietarios 75,3 %'],
        ['rgb(86, 180, 233)', 'Inquilinos a precio de mercado 15,9 %'],
      ]);
    });

    it('shows the EU split as a pie when no region is selected', async () => {
      const { fixture } = await render(tenureCard());
      const [pie] = charts(fixture);
      expect(pie?.label).toBe('Reparto de Régimen de tenencia: media UE en 2024');
      expect(pie?.option.series[0]?.data).toEqual([
        { name: 'Propietarios', value: 69 },
        { name: 'Inquilinos a precio de mercado', value: 21 },
      ]);
    });

    it('shows the split of the selected region', async () => {
      const { fixture } = await render(tenureCard('ES'));
      const [pie] = charts(fixture);
      expect(pie?.label).toBe('Reparto de Régimen de tenencia: España en 2024');
      expect(pie?.option.series[0]?.data).toEqual([
        { name: 'Propietarios', value: 75.3 },
        { name: 'Inquilinos a precio de mercado', value: 15.9 },
      ]);
    });

    it('selects the country whose bar is clicked', async () => {
      const { fixture, picked } = await render(tenureCard());
      const bars = fixture.debugElement.queryAll(By.directive(ChartComponent))[1];

      (bars?.componentInstance as ChartComponent).picked.emit(1);

      expect(picked).toHaveBeenCalledWith('ES');
    });

    it('ignores clicks outside the bars of a country', async () => {
      const { fixture, picked } = await render(tenureCard());
      const bars = fixture.debugElement.queryAll(By.directive(ChartComponent))[1];

      (bars?.componentInstance as ChartComponent).picked.emit(7);

      expect(picked).not.toHaveBeenCalled();
    });

    it('compares the countries in bars, in the order of the map category', async () => {
      const { fixture, element } = await render(tenureCard());
      const [, bars] = charts(fixture);
      expect(bars?.label).toBe('Régimen de tenencia por país en 2024');
      expect(bars?.option.yAxis?.data).toEqual(['Portugal', 'España']);
      expect(bars?.option.series.map((series) => series.name)).toEqual([
        'Propietarios',
        'Inquilinos a precio de mercado',
      ]);
      const titles = [...element.querySelectorAll('h4')].map((title) => title.textContent?.trim());
      expect(titles).toEqual(['Reparto', 'Comparación entre países']);
      expect(element.querySelector('app-ranking')).toBeNull();
    });
  });
});
