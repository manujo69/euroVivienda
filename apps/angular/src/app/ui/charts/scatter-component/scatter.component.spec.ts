import { DeferBlockState, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { IndicatorMeta } from '@eurovivienda/contract';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { Scatter } from '../../../application/explorer.store';
import { ChartComponent } from '../chart-component/chart.component';
import { ScatterComponent } from './scatter.component';

const meta = (id: string, label: string, unit: string): IndicatorMeta => ({
  id,
  label,
  theme: 'access',
  kind: 'scalar',
  unit,
  levels: [0],
  years: [2015, 2025],
  source: { name: 'Eurostat', code: id, url: 'https://example.test', lastUpdate: '2026-09-17' },
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [10, 20] },
});

const overburden = meta('overburden', 'Sobrecarga por coste de vivienda', '%');
const emancipation = meta('emancipation', 'Edad media de emancipación', 'años');
const pair = {
  x: { id: 'emancipation', breakdown: 'total' },
  y: { id: 'overburden', breakdown: 'youth' },
};

const scatter = (extra: Partial<Scatter> = {}): Scatter => ({
  pair,
  suggested: [{ pair, label: 'Sobrecarga (Jóvenes) frente a Edad media de emancipación' }],
  axes: [
    { id: 'overburden', breakdown: 'total', label: overburden.label },
    { id: 'emancipation', breakdown: 'total', label: emancipation.label },
  ],
  level: 0,
  label: 'Sobrecarga (Jóvenes) frente a Edad media de emancipación',
  x: { meta: emancipation, breakdown: 'total', year: 2023, values: [] },
  y: { meta: overburden, breakdown: 'youth', year: 2024, values: [] },
  points: [
    { geo: 'ES', x: 30, y: 12 },
    { geo: 'FR', x: 24, y: 10 },
    { geo: 'PT', x: 29, y: 9 },
  ],
  r: 0.339,
  selected: undefined,
  names: {},
  ...extra,
});

describe('ScatterComponent', () => {
  async function render(value: Scatter) {
    const fixture = TestBed.createComponent(ScatterComponent);
    fixture.componentRef.setInput('scatter', value);
    fixture.detectChanges();
    for (const block of await fixture.getDeferBlocks()) {
      await block.render(DeferBlockState.Complete);
    }
    const chosen = jasmine.createSpy('pairChosen');
    const picked = jasmine.createSpy('regionPicked');
    fixture.componentInstance.pairChosen.subscribe(chosen);
    fixture.componentInstance.regionPicked.subscribe(picked);
    return { fixture, element: fixture.nativeElement as HTMLElement, chosen, picked };
  }

  const text = (element: HTMLElement, selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const select = (element: HTMLElement, label: string) =>
    [...element.querySelectorAll('label')]
      .find((item) => item.textContent?.includes(label))
      ?.querySelector('select');
  const choose = (element: HTMLSelectElement | null | undefined, value: string) => {
    if (!element) return;
    element.value = value;
    element.dispatchEvent(new Event('change'));
  };

  it('titles the card with the pair, named from the catalogue', async () => {
    const { element } = await render(scatter());
    expect(text(element, 'h3')).toBe('Sobrecarga (Jóvenes) frente a Edad media de emancipación');
  });

  it('names each axis with its indicator, unit and year', async () => {
    const { element } = await render(scatter());
    const axes = [...element.querySelectorAll('.axes li')].map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(axes).toEqual([
      'Eje vertical: Sobrecarga por coste de vivienda (%, 2024)',
      'Eje horizontal: Edad media de emancipación (años, 2023)',
    ]);
  });

  it('gives r and the number of countries, and warns that it is no cause', async () => {
    const { element } = await render(scatter());
    expect(text(element, '.correlation')).toBe('r = 0,34 · 3 países');
    expect(text(element, '.warning')).toBe(
      'Correlación no implica causa: la relación es solo descriptiva.',
    );
  });

  it('counts regions at NUTS 2, and says why there is no r', async () => {
    const { element } = await render(scatter({ level: 2, r: undefined, points: [] }));
    expect(text(element, '.correlation')).toBe(
      'Sin r: hacen falta al menos tres regiones con dato en los dos ejes.',
    );
  });

  it('offers the suggested pairs, and asks for the one chosen', async () => {
    const other = { x: pair.y, y: pair.x };
    const { element, chosen } = await render(
      scatter({
        suggested: [
          { pair, label: 'Una' },
          { pair: other, label: 'Otra' },
        ],
      }),
    );
    const suggested = select(element, 'Pareja sugerida');
    expect([...(suggested?.options ?? [])].map((option) => option.text.trim())).toEqual([
      'Una',
      'Otra',
    ]);

    choose(suggested, '1');

    expect(chosen).toHaveBeenCalledWith(other);
  });

  it('lets the user choose each axis among the numeric active indicators', async () => {
    const { element, chosen } = await render(scatter());

    choose(select(element, 'Eje horizontal'), 'overburden');

    expect(chosen).toHaveBeenCalledWith({
      x: { id: 'overburden', breakdown: 'total' },
      y: pair.y,
    });
  });

  it('draws the points, and selects the region clicked', async () => {
    const { fixture, picked } = await render(scatter());
    const chart = fixture.debugElement.query(By.directive(NgxEchartsDirective));
    const option = chart.injector.get(NgxEchartsDirective).options() as {
      series: { data: { name: string }[] }[];
    };
    expect(option.series[0]?.data.map((point) => point.name)).toEqual(['ES', 'FR', 'PT']);

    const wrapper = fixture.debugElement.query(By.directive(ChartComponent));
    (wrapper.componentInstance as ChartComponent).picked.emit(2);

    expect(picked).toHaveBeenCalledWith('PT');
  });

  it('says so instead of an empty chart when no region has both values', async () => {
    const { element } = await render(scatter({ points: [], r: undefined }));
    expect(element.querySelector('app-chart')).toBeNull();
    expect(text(element, '.empty')).toBe('Ninguna región tiene dato en los dos ejes.');
  });
});
