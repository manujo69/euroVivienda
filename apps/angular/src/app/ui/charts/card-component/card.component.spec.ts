import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { IndicatorData } from '@eurovivienda/contract';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { IndicatorMeta } from '@eurovivienda/contract';
import type { Card } from '../../../application/explorer.store';
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
  ...extra,
});

describe('CardComponent', () => {
  function render(value: Card) {
    const fixture = TestBed.createComponent(CardComponent);
    fixture.componentRef.setInput('card', value);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const text = (element: HTMLElement, selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  it('titles the card with the indicator from the catalogue', () => {
    const { element } = render(card());
    expect(text(element, 'h3')).toBe('Sobrecarga por coste de vivienda');
  });

  it('leads with the figure, its unit and a sentence that explains it', () => {
    const { element } = render(card());
    expect(text(element, '.headline .figure')).toBe('8,2 %');
    expect(text(element, '.headline .explanation')).toBe('Media UE en 2024');
  });

  it('names the selected region and spells out its flags', () => {
    const { element } = render(card({ headline: { geo: 'PT', value: 5.1, flags: 'p' } }));
    expect(text(element, '.headline .explanation')).toBe('Portugal en 2024');
    expect(text(element, '.headline sup [aria-hidden="true"]')).toBe('p');
    expect(text(element, '.headline sup .visually-hidden')).toBe('provisional');
  });

  it('says so when there is no figure to show', () => {
    const { element } = render(card({ headline: undefined }));
    expect(text(element, '.headline')).toBe('Sin dato');
  });

  it('offers no button to open a card that is already open', () => {
    const { element } = render(card());
    expect(element.querySelector('button')).toBeNull();
  });

  it('asks to be opened when folded', () => {
    const { fixture, element } = render(card({ open: false }));
    const opened = jasmine.createSpy('opened');
    fixture.componentInstance.opened.subscribe(opened);

    const button = element.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-label')).toBe('Abrir Sobrecarga por coste de vivienda');
    button?.click();

    expect(opened).toHaveBeenCalled();
  });

  describe('scalar charts', () => {
    const lines = (fixture: ReturnType<typeof render>['fixture']) => {
      const chart = fixture.debugElement.query(By.directive(NgxEchartsDirective));
      const option = chart.injector.get(NgxEchartsDirective).options() as {
        series: { name: string; data: (number | null)[] }[];
      };
      return {
        label: (chart.nativeElement as HTMLElement).getAttribute('aria-label'),
        series: option.series.map((line) => [line.name, line.data]),
      };
    };

    it('shows the evolution of the EU mean and the ranking when open', () => {
      const { fixture, element } = render(card({ data: series }));
      const titles = [...element.querySelectorAll('h4')].map((title) => title.textContent?.trim());
      expect(titles).toEqual(['Evolución', 'Ranking 2024']);
      expect(lines(fixture)).toEqual({
        label: 'Evolución de Sobrecarga por coste de vivienda: media UE',
        series: [['Media UE', [9.9, 9.5]]],
      });
      expect(element.querySelector('app-ranking')).not.toBeNull();
    });

    it('draws the selected region against the EU mean', () => {
      const { fixture } = render(card({ data: series, selected: 'ES' }));
      expect(lines(fixture)).toEqual({
        label: 'Evolución de Sobrecarga por coste de vivienda: España frente a la media UE',
        series: [
          ['España', [9.1, 8.4]],
          ['Media UE', [9.9, 9.5]],
        ],
      });
    });

    it('draws no charts while folded', () => {
      const { element } = render(card({ data: series, open: false }));
      expect(element.querySelector('app-line-chart')).toBeNull();
      expect(element.querySelector('app-ranking')).toBeNull();
    });

    it('marks derived indicators as own elaboration', () => {
      const { element } = render(card({ meta: { ...overburden, kind: 'derived' } }));
      expect(text(element, '.own')).toBe('Elaboración propia');
      expect(element.querySelector('app-line-chart')).not.toBeNull();
    });
  });
});
