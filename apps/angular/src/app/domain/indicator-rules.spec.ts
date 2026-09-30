import type { IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import { byTheme, classOf, mapValue, resolveYear, valuesByGeo } from './indicator-rules';

const meta = (kind: IndicatorMeta['kind'], extra: Partial<IndicatorMeta> = {}): IndicatorMeta => ({
  id: 'x',
  label: 'X',
  theme: 'access',
  kind,
  unit: '%',
  levels: [0],
  years: [2015, 2025],
  source: { name: 'Eurostat', code: 'x', url: 'https://example.test', lastUpdate: '2026-09-17' },
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [10, 20] },
  ...extra,
});

describe('mapValue', () => {
  it('paints the value of scalars and derived indicators', () => {
    expect(mapValue(meta('scalar'), { v: 7.5 })).toBe(7.5);
    expect(mapValue(meta('derived'), { v: 104 })).toBe(104);
  });

  it('paints the change since 2015 of indices', () => {
    expect(mapValue(meta('index'), { v: 135.5 })).toBeCloseTo(35.5);
  });

  it('paints the map category of compositions', () => {
    const tenure = meta('composition', { categories: ['own', 'rent_mkt'], mapCategory: 'rent' });
    expect(mapValue(tenure, { v: { own: 70, rent_mkt: 20, rent: 30 } })).toBe(30);
    expect(mapValue(tenure, { v: { own: 70 } })).toBeUndefined();
  });
});

describe('classOf', () => {
  it('counts the breaks at or below the value', () => {
    expect(classOf(5, [10, 20])).toBe(0);
    expect(classOf(10, [10, 20])).toBe(1);
    expect(classOf(19.9, [10, 20])).toBe(1);
    expect(classOf(25, [10, 20])).toBe(2);
  });
});

describe('resolveYear', () => {
  const data: IndicatorData = {
    ES: { '2023': { total: { v: 1 } }, '2024': { total: { v: 2 } } },
    PT: { '2022': { total: { v: 3 } } },
  };

  it('keeps the requested year when there is data', () => {
    expect(resolveYear(data, 2023)).toBe(2023);
  });

  it('falls back to the latest earlier year with data', () => {
    expect(resolveYear(data, 2025)).toBe(2024);
  });

  it('gives nothing when every year with data is later', () => {
    expect(resolveYear(data, 2020)).toBeUndefined();
  });
});

describe('valuesByGeo with notes', () => {
  it('passes on the note of a value', () => {
    const data: IndicatorData = { RO: { '2025': { total: { v: 56, n: 'Muestra pequeña.' } } } };
    expect(valuesByGeo(meta('scalar'), data, 2025, 'total').values).toEqual([
      { geo: 'RO', value: 56, flags: undefined, note: 'Muestra pequeña.' },
    ]);
  });
});

describe('valuesByGeo', () => {
  const data: IndicatorData = {
    ES: { '2024': { total: { v: 7.8 }, youth: { v: 7.2, f: 'p' } } },
    PT: { '2024': { total: { v: 5.1 } } },
    FR: { '2023': { total: { v: 4.9 } } },
    EU27_2020: { '2024': { total: { v: 8.2, f: 'e' } } },
  };
  const overburden = meta('scalar', {
    breakdowns: [
      { id: 'total', label: 'Total' },
      { id: 'youth', label: 'Jóvenes' },
    ],
  });

  it('lists the countries with a value for the year and breakdown, EU mean apart', () => {
    expect(valuesByGeo(overburden, data, 2024, 'youth')).toEqual({
      values: [{ geo: 'ES', value: 7.2, flags: 'p' }],
      eu: undefined,
    });
    expect(valuesByGeo(overburden, data, 2024, 'total')).toEqual({
      values: [
        { geo: 'ES', value: 7.8, flags: undefined },
        { geo: 'PT', value: 5.1, flags: undefined },
      ],
      eu: { geo: 'EU27_2020', value: 8.2, flags: 'e' },
    });
  });
});

describe('byTheme', () => {
  const indicator = (id: string, theme: IndicatorMeta['theme']) => ({
    ...meta('scalar'),
    id,
    theme,
  });

  it('groups the catalogue by theme in a fixed order, keeping the catalogue order inside', () => {
    const catalog = [
      indicator('unemployment', 'context'),
      indicator('overburden', 'access'),
      indicator('hpi', 'prices'),
      indicator('tenure', 'access'),
    ];
    expect(
      byTheme(catalog).map((group) => [group.theme, group.indicators.map((item) => item.id)]),
    ).toEqual([
      ['prices', ['hpi']],
      ['access', ['overburden', 'tenure']],
      ['context', ['unemployment']],
    ]);
  });

  it('leaves out themes without indicators', () => {
    expect(byTheme([indicator('overburden', 'access')]).map((group) => group.theme)).toEqual([
      'access',
    ]);
  });
});
