import { describe, expect, it } from 'vitest';
import { catalogSchema, indicatorDataSchema, indicatorMetaSchema } from '../src/index.ts';
import type { IndicatorData, IndicatorMeta } from '../src/index.ts';

const hpi: IndicatorMeta = {
  id: 'hpi',
  label: 'Variación del precio de la vivienda',
  theme: 'prices',
  kind: 'index',
  unit: 'Índice (2015 = 100)',
  levels: [0],
  years: [2015, 2025],
  source: {
    name: 'Eurostat',
    code: 'prc_hpi_a',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_a/default/table',
    lastUpdate: '2026-07-02',
  },
  breakdowns: [
    { id: 'total', label: 'Todas las viviendas' },
    { id: 'new', label: 'Vivienda nueva' },
  ],
  scale: 'sequential',
  breaks: { total: [110, 130, 150], new: [115, 135, 160] },
};

const tenure: IndicatorMeta = {
  ...hpi,
  id: 'tenure',
  label: 'Régimen de tenencia',
  theme: 'access',
  kind: 'composition',
  unit: '%',
  breakdowns: [{ id: 'total', label: 'Total' }],
  categories: ['own_l', 'own_nl', 'rent_mkt', 'rent_fr'],
  mapCategory: 'rent',
  breaks: { total: [20, 30, 40] },
};

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('indicatorMetaSchema', () => {
  it('accepts a complete indicator', () => {
    expect(indicatorMetaSchema.parse(hpi)).toEqual(hpi);
    expect(indicatorMetaSchema.parse(tenure)).toEqual(tenure);
  });

  it('rejects unknown fields', () => {
    expect(indicatorMetaSchema.safeParse({ ...hpi, colour: 'red' }).success).toBe(false);
  });

  it('rejects years in the wrong order', () => {
    expect(issues(indicatorMetaSchema.safeParse({ ...hpi, years: [2025, 2015] }))).toContain(
      'years must go from first to last',
    );
  });

  it('rejects repeated breakdown ids', () => {
    const breakdowns = [hpi.breakdowns[0], hpi.breakdowns[0]];
    expect(issues(indicatorMetaSchema.safeParse({ ...hpi, breakdowns }))).toContain(
      'repeated breakdown id: total',
    );
  });

  it('asks compositions, and only them, for categories and a map category', () => {
    expect(issues(indicatorMetaSchema.safeParse({ ...tenure, mapCategory: undefined }))).toContain(
      'composition needs categories and mapCategory',
    );
    expect(issues(indicatorMetaSchema.safeParse({ ...hpi, categories: ['a'] }))).toContain(
      'only compositions have categories or mapCategory',
    );
  });

  it('needs ascending class breaks for exactly the declared breakdowns', () => {
    expect(issues(indicatorMetaSchema.safeParse({ ...hpi, breaks: { total: [1, 2] } }))).toContain(
      'breaks must cover exactly the breakdowns: total, new',
    );
    const breaks = { total: [1, 3, 2], new: [1] };
    expect(issues(indicatorMetaSchema.safeParse({ ...hpi, breaks }))).toContain(
      'breaks of total must be ascending',
    );
  });
});

describe('catalogSchema', () => {
  it('rejects two indicators with the same id', () => {
    expect(issues(catalogSchema.safeParse([hpi, hpi]))).toContain('repeated indicator id: hpi');
    expect(catalogSchema.parse([hpi, tenure])).toHaveLength(2);
  });
});

describe('indicatorDataSchema', () => {
  const data: IndicatorData = {
    ES: { '2015': { total: { v: 100 }, new: { v: 100 } }, '2025': { total: { v: 187.3, f: 'p' } } },
    EU27_2020: { '2025': { total: { v: 160.2 } } },
  };

  it('accepts data that matches its indicator', () => {
    expect(indicatorDataSchema(hpi).parse(data)).toEqual(data);
    const shares = {
      ES: {
        '2024': { total: { v: { own_l: 30, own_nl: 45, rent_mkt: 15, rent_fr: 10, rent: 25 } } },
      },
    };
    expect(indicatorDataSchema(tenure).parse(shares)).toEqual(shares);
  });

  it('rejects breakdowns and years the indicator does not declare', () => {
    const result = indicatorDataSchema(hpi).safeParse({
      ES: { '2014': { total: { v: 90 } }, '2016': { youth: { v: 101 } } },
    });
    expect(issues(result)).toEqual(['year outside 2015–2025: 2014', 'undeclared breakdown: youth']);
  });

  it('needs a number for scalars and known categories for compositions', () => {
    expect(
      issues(indicatorDataSchema(hpi).safeParse({ ES: { '2016': { total: { v: { a: 1 } } } } })),
    ).toContain('value must be a number');
    expect(
      issues(indicatorDataSchema(tenure).safeParse({ ES: { '2016': { total: { v: 30 } } } })),
    ).toContain('value must be a record of categories');
    expect(
      issues(
        indicatorDataSchema(tenure).safeParse({ ES: { '2016': { total: { v: { owners: 30 } } } } }),
      ),
    ).toContain('unknown category: owners');
  });

  it('accepts only Eurostat flag letters', () => {
    const result = indicatorDataSchema(hpi).safeParse({
      ES: { '2016': { total: { v: 101, f: 'x' } } },
    });
    expect(result.success).toBe(false);
    expect(
      indicatorDataSchema(hpi).safeParse({ ES: { '2016': { total: { v: 101, f: 'bdu' } } } })
        .success,
    ).toBe(true);
  });

  it('carries an optional note that explains one value', () => {
    const note =
      'Solo el 2,3 % de la población está en este grupo: estimación con una muestra pequeña.';
    const data = { RO: { '2025': { total: { v: 156, n: note } } } };
    expect(indicatorDataSchema(hpi).parse(data)).toEqual(data);
    expect(
      indicatorDataSchema(hpi).safeParse({ RO: { '2025': { total: { v: 156, n: '' } } } }).success,
    ).toBe(false);
  });
});
