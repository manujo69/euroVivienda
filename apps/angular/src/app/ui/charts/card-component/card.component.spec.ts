import { TestBed } from '@angular/core/testing';
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

const card = (extra: Partial<Card> = {}): Card => ({
  meta: overburden,
  open: true,
  year: 2024,
  headline: { geo: 'EU27_2020', value: 8.2, flags: undefined },
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
});
