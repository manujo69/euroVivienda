import type { IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import {
  byTheme,
  classOf,
  headline,
  mapValue,
  openCards,
  resolveYear,
  shortRanking,
  slicesOf,
  timeSeries,
  valuesByGeo,
  yearRange,
} from './indicator-rules';

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
    const tenure = meta('composition', {
      categories: [
        { id: 'own', label: 'Propietarios' },
        { id: 'rent_mkt', label: 'Inquilinos a precio de mercado' },
      ],
      mapCategory: { id: 'rent', label: 'Inquilinos' },
    });
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

  it('leaves out the NUTS 2 regions of regional indicators', () => {
    const regional: IndicatorData = {
      ...data,
      ES30: { '2024': { total: { v: 9.9 } } },
      PT17: { '2024': { total: { v: 3.3 } } },
    };
    expect(
      valuesByGeo(overburden, regional, 2024, 'total').values.map((entry) => entry.geo),
    ).toEqual(['ES', 'PT']);
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

describe('openCards', () => {
  it('keeps open the four cards used most recently', () => {
    expect([...openCards(['a', 'b', 'c', 'd', 'e', 'f'])]).toEqual(['c', 'd', 'e', 'f']);
  });

  it('keeps every card open while there are four or fewer', () => {
    expect([...openCards(['a', 'b'])]).toEqual(['a', 'b']);
  });
});

describe('headline', () => {
  const values = [
    { geo: 'ES', value: 7.8, flags: undefined },
    { geo: 'PT', value: 5.1, flags: 'p' },
  ];
  const eu = { geo: 'EU27_2020', value: 8.2, flags: undefined };

  it('gives the value of the selected region', () => {
    expect(headline(values, eu, 'PT')).toBe(values[1]);
  });

  it('falls back to the EU mean with no selection or no value for it', () => {
    expect(headline(values, eu, undefined)).toBe(eu);
    expect(headline(values, eu, 'FR')).toBe(eu);
  });

  it('has nothing to show without selection or EU mean', () => {
    expect(headline(values, undefined, undefined)).toBeUndefined();
  });
});

describe('timeSeries', () => {
  const data: IndicatorData = {
    ES: {
      '2016': { total: { v: 102 } },
      '2015': { total: { v: 100, f: 'p' } },
      '2017': { youth: { v: 7 } },
    },
    PT: { '2015': { total: { v: { own: 70, rent: 30 } } } },
  };

  it('gives the values of one region and breakdown, oldest year first', () => {
    expect(timeSeries(data, 'ES', 'total')).toEqual([
      { year: 2015, value: 100, flags: 'p' },
      { year: 2016, value: 102, flags: undefined },
    ]);
  });

  it('is empty for regions without data and for compositions', () => {
    expect(timeSeries(data, 'FR', 'total')).toEqual([]);
    expect(timeSeries(data, 'PT', 'total')).toEqual([]);
  });
});

describe('shortRanking', () => {
  const values = ['AT', 'BE', 'CZ', 'DE', 'ES', 'FI', 'FR', 'IT'].map((geo, i) => ({
    geo,
    value: i,
    flags: undefined,
  }));
  const ranks = (rows: ReturnType<typeof shortRanking>) => rows.map((row) => [row.rank, row.geo]);

  it('lists the top three and the bottom three, highest value first', () => {
    expect(ranks(shortRanking(values, undefined))).toEqual([
      [1, 'IT'],
      [2, 'FR'],
      [3, 'FI'],
      [6, 'CZ'],
      [7, 'BE'],
      [8, 'AT'],
    ]);
  });

  it('adds the selected region in its place when it is in the middle', () => {
    expect(ranks(shortRanking(values, 'DE'))).toEqual([
      [1, 'IT'],
      [2, 'FR'],
      [3, 'FI'],
      [5, 'DE'],
      [6, 'CZ'],
      [7, 'BE'],
      [8, 'AT'],
    ]);
  });

  it('lists everyone when there are six or fewer', () => {
    expect(ranks(shortRanking(values.slice(0, 4), undefined))).toEqual([
      [1, 'DE'],
      [2, 'CZ'],
      [3, 'BE'],
      [4, 'AT'],
    ]);
  });
});

describe('slicesOf', () => {
  const tenure = meta('composition', {
    categories: [
      { id: 'own', label: 'Propietarios' },
      { id: 'rent_mkt', label: 'Inquilinos a precio de mercado' },
    ],
    mapCategory: { id: 'rent', label: 'Inquilinos' },
  });
  const data: IndicatorData = {
    ES: { '2024': { total: { v: { own: 75.3, rent_mkt: 15.9, rent: 24.7 } } } },
  };

  it('gives the slices of a region in catalogue order, named, without the map category', () => {
    expect(slicesOf(tenure, data, 'ES', 2024, 'total')).toEqual([
      { id: 'own', label: 'Propietarios', value: 75.3 },
      { id: 'rent_mkt', label: 'Inquilinos a precio de mercado', value: 15.9 },
    ]);
  });

  it('is empty without data for that region and year', () => {
    expect(slicesOf(tenure, data, 'PT', 2024, 'total')).toEqual([]);
    expect(slicesOf(tenure, data, 'ES', 2023, 'total')).toEqual([]);
  });
});

describe('yearRange', () => {
  it('spans every year of the indicators given, newest first', () => {
    const hpi = meta('index', { years: [2015, 2025] });
    const income = meta('scalar', { years: [2016, 2023] });
    expect(yearRange([income])).toEqual([2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]);
    expect(yearRange([hpi, income])[0]).toBe(2025);
    expect(yearRange([hpi, income]).at(-1)).toBe(2015);
  });

  it('is empty without indicators', () => {
    expect(yearRange([])).toEqual([]);
  });
});
