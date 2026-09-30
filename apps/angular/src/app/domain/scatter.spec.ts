import type { IndicatorMeta } from '@eurovivienda/contract';
import { pairLabel, pairOptions, pearson, scatterPoints, type Pair } from './scatter';

const meta = (id: string, extra: Partial<IndicatorMeta> = {}): IndicatorMeta => ({
  id,
  label: id,
  theme: 'access',
  kind: 'scalar',
  unit: '%',
  levels: [0],
  years: [2015, 2025],
  source: { name: 'Eurostat', code: id, url: 'https://example.test', lastUpdate: '2026-09-17' },
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [10, 20] },
  ...extra,
});

const overburden = meta('overburden', {
  label: 'Sobrecarga por coste de vivienda',
  breakdowns: [
    { id: 'rent_mkt', label: 'Inquilinos a precio de mercado' },
    { id: 'youth', label: 'Jóvenes de 20 a 29 años' },
    { id: 'total', label: 'Toda la población' },
  ],
});
const emancipation = meta('emancipation', { label: 'Edad media de emancipación' });
const unemployment = meta('unemployment', { label: 'Tasa de paro', levels: [0, 2] });
const income = meta('income', { label: 'Renta disponible', levels: [0, 2] });
const hpi = meta('hpi', { label: 'Variación del precio de la vivienda', kind: 'index' });
const tenure = meta('tenure', { kind: 'composition' });

const value = (geo: string, v: number) => ({ geo, value: v, flags: undefined });

describe('pearson', () => {
  it('measures a perfect, an inverse and no linear relation', () => {
    expect(
      pearson([
        [1, 2],
        [2, 4],
        [3, 6],
      ]),
    ).toBeCloseTo(1);
    expect(
      pearson([
        [1, 3],
        [2, 2],
        [3, 1],
      ]),
    ).toBeCloseTo(-1);
    expect(
      pearson([
        [1, 1],
        [2, 3],
        [3, 1],
        [4, 3],
      ]),
    ).toBeCloseTo(0.447, 3);
  });

  it('has no value with fewer than three points or no spread', () => {
    expect(
      pearson([
        [1, 2],
        [2, 4],
      ]),
    ).toBeUndefined();
    expect(
      pearson([
        [1, 2],
        [1, 3],
        [1, 4],
      ]),
    ).toBeUndefined();
  });
});

describe('scatterPoints', () => {
  it('pairs the regions with a value on both axes', () => {
    expect(
      scatterPoints(
        [value('ES', 1), value('PT', 2), value('FR', 3)],
        [value('PT', 20), value('ES', 10)],
      ),
    ).toEqual([
      { geo: 'ES', x: 1, y: 10 },
      { geo: 'PT', x: 2, y: 20 },
    ]);
  });
});

describe('pairOptions', () => {
  it('suggests the pairs of spec.md whose indicators are active, first', () => {
    const options = pairOptions([overburden, emancipation, unemployment, hpi], 0);
    expect(options.suggested).toEqual([
      {
        x: { id: 'emancipation', breakdown: 'total' },
        y: { id: 'overburden', breakdown: 'youth' },
      },
      {
        x: { id: 'unemployment', breakdown: 'total' },
        y: { id: 'overburden', breakdown: 'total' },
      },
    ]);
  });

  it('offers the numeric indicators for the free choice, not the compositions', () => {
    expect(pairOptions([overburden, tenure, hpi], 0).axes.map((axis) => axis.id)).toEqual([
      'overburden',
      'hpi',
    ]);
  });

  it('offers only regional indicators at NUTS 2', () => {
    const options = pairOptions([overburden, unemployment, income, hpi], 2);
    expect(options.axes.map((axis) => axis.id)).toEqual(['unemployment', 'income']);
    expect(options.suggested).toEqual([]);
  });
});

describe('pairLabel', () => {
  it('names the pair from the catalogue, with a breakdown other than the first', () => {
    const pair: Pair = {
      x: { id: 'emancipation', breakdown: 'total' },
      y: { id: 'overburden', breakdown: 'youth' },
    };
    expect(pairLabel(pair, [overburden, emancipation])).toBe(
      'Sobrecarga por coste de vivienda (Jóvenes de 20 a 29 años) frente a Edad media de emancipación',
    );
  });
});
