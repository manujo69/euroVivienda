import type { DuckDBConnection } from '@duckdb/node-api';
import { describe, expect, it } from 'vitest';
import { rows, withModel } from './staging-fixture.ts';
import type { Row } from './staging-fixture.ts';

const model = <T>(data: Record<string, Row[]>, use: (connection: DuckDBConnection) => Promise<T>) =>
  withModel(data, ['model'], use);

const observations = (indicator: string) => `
  SELECT geo, year, breakdown, category, round(value, 2) AS value, flags
  FROM model.observation WHERE indicator_id = '${indicator}' ORDER BY ALL`;

describe('model.geo', () => {
  it('keeps EU countries and regions of NUTS 2024 plus the EU aggregate', async () => {
    const geo = await model({}, (connection) =>
      rows(connection, 'SELECT * FROM model.geo ORDER BY code'),
    );
    expect(geo).toEqual([
      {
        code: 'ES',
        level: 0,
        country: 'ES',
        name: 'España',
        nuts_version: '2024',
        is_aggregate: false,
        is_outermost: false,
      },
      {
        code: 'ES30',
        level: 2,
        country: 'ES',
        name: 'Comunidad de Madrid',
        nuts_version: '2024',
        is_aggregate: false,
        is_outermost: false,
      },
      {
        code: 'ES51',
        level: 2,
        country: 'ES',
        name: 'Cataluña',
        nuts_version: '2024',
        is_aggregate: false,
        is_outermost: false,
      },
      {
        code: 'ES70',
        level: 2,
        country: 'ES',
        name: 'Canarias',
        nuts_version: '2024',
        is_aggregate: false,
        is_outermost: true,
      },
      {
        code: 'EU27_2020',
        level: 0,
        country: 'EU',
        name: 'Unión Europea (UE-27)',
        nuts_version: '2024',
        is_aggregate: true,
        is_outermost: false,
      },
    ]);
  });
});

describe('model.indicator', () => {
  it('lists the ten catalogue indicators with their breakdowns', async () => {
    const indicators = await model({}, (connection) =>
      rows(
        connection,
        'SELECT id, kind, levels, breakdowns, categories, map_category FROM model.indicator ORDER BY id',
      ),
    );
    expect(indicators.map((indicator) => indicator.id)).toEqual([
      'emancipation',
      'hpi',
      'income',
      'overburden',
      'popgrowth',
      'price_income',
      'rent',
      'tenure',
      'tourism',
      'unemployment',
    ]);
    const tenure = indicators.find((indicator) => indicator.id === 'tenure');
    expect(tenure).toMatchObject({ kind: 'composition', levels: [0], map_category: 'rent' });
    expect(JSON.parse(tenure?.categories as string)).toEqual([
      'own_l',
      'own_nl',
      'rent_mkt',
      'rent_fr',
    ]);
    expect(indicators.find((indicator) => indicator.id === 'unemployment')).toMatchObject({
      levels: [0, 2],
    });
  });

  it('opens overburden on the people who pay rent or a mortgage, the whole population last', async () => {
    const [overburden] = await model({}, (connection) =>
      rows(
        connection,
        "SELECT breakdowns::VARCHAR AS b FROM model.indicator WHERE id = 'overburden'",
      ),
    );
    const breakdowns = JSON.parse(overburden?.b as string) as { id: string; label: string }[];
    expect(breakdowns).toEqual([
      { id: 'rent_mkt', label: 'Inquilinos a precio de mercado' },
      { id: 'rent', label: 'Todos los inquilinos (cálculo propio)' },
      { id: 'own_l', label: 'Propietarios con hipoteca' },
      { id: 'rent_fr', label: 'Inquilinos con alquiler reducido o gratuito' },
      { id: 'youth', label: 'Jóvenes de 20 a 29 años' },
      { id: 'own_nl', label: 'Propietarios sin hipoteca' },
      { id: 'total', label: 'Toda la población' },
    ]);
  });
});

describe('model.observation', () => {
  it('rebases indices to 2015 = 100 per geography and breakdown, keeping flags', async () => {
    const data = {
      prc_hpi_a: [
        { geo: 'ES', TIME_PERIOD: '2015', OBS_VALUE: 50 },
        { geo: 'ES', TIME_PERIOD: '2016', OBS_VALUE: 75, OBS_FLAG: 'p' },
        { geo: 'ES', purchase: 'DW_NEW', TIME_PERIOD: '2015', OBS_VALUE: 40 },
        { geo: 'ES', purchase: 'DW_NEW', TIME_PERIOD: '2016', OBS_VALUE: 44 },
      ],
    };
    expect(await model(data, (connection) => rows(connection, observations('hpi')))).toEqual([
      { geo: 'ES', year: 2015, breakdown: 'new', category: '_', value: 100, flags: null },
      { geo: 'ES', year: 2015, breakdown: 'total', category: '_', value: 100, flags: null },
      { geo: 'ES', year: 2016, breakdown: 'new', category: '_', value: 110, flags: null },
      { geo: 'ES', year: 2016, breakdown: 'total', category: '_', value: 150, flags: 'p' },
    ]);
  });

  it('drops geographies outside the EU-27, empty values and years after 2025', async () => {
    const data = {
      lfst_r_lfu3rt: [
        { geo: 'ES', TIME_PERIOD: '2025', OBS_VALUE: 10 },
        { geo: 'ES', TIME_PERIOD: '2026', OBS_VALUE: 9 },
        { geo: 'NO', TIME_PERIOD: '2025', OBS_VALUE: 4 },
        { geo: 'ES30', TIME_PERIOD: '2025', OBS_VALUE: null, OBS_FLAG: 'u' },
        { geo: 'ESZZ', TIME_PERIOD: '2025', OBS_VALUE: 30 },
      ],
    };
    expect(
      await model(data, (connection) => rows(connection, observations('unemployment'))),
    ).toEqual([
      { geo: 'ES', year: 2025, breakdown: 'total', category: '_', value: 10, flags: null },
    ]);
  });

  it('keeps income in PPS per inhabitant up to 2023', async () => {
    const data = {
      nama_10r_2hhinc: [
        { geo: 'ES30', TIME_PERIOD: '2023', OBS_VALUE: 30000 },
        { geo: 'ES30', TIME_PERIOD: '2024', OBS_VALUE: 31000 },
        { geo: 'ES30', unit: 'EUR_HAB', TIME_PERIOD: '2023', OBS_VALUE: 28000 },
      ],
    };
    expect(await model(data, (connection) => rows(connection, observations('income')))).toEqual([
      { geo: 'ES30', year: 2023, breakdown: 'total', category: '_', value: 30000, flags: null },
    ]);
  });

  it('turns nights per thousand inhabitants into nights per inhabitant', async () => {
    const data = { tour_occ_nin2: [{ geo: 'ES30', TIME_PERIOD: '2024', OBS_VALUE: 5250 }] };
    expect(await model(data, (connection) => rows(connection, observations('tourism')))).toEqual([
      { geo: 'ES30', year: 2024, breakdown: 'total', category: '_', value: 5.25, flags: null },
    ]);
  });

  it('splits overburden into age and tenure breakdowns', async () => {
    const data = {
      ilc_lvho07a: [
        { geo: 'ES', TIME_PERIOD: '2024', OBS_VALUE: 8 },
        { geo: 'ES', age: 'Y20-29', TIME_PERIOD: '2024', OBS_VALUE: 12 },
      ],
      ilc_lvho07c: [
        { geo: 'ES', tenure: 'TOTAL', TIME_PERIOD: '2024', OBS_VALUE: 8 },
        { geo: 'ES', tenure: 'RENT_MKT', TIME_PERIOD: '2024', OBS_VALUE: 35 },
      ],
    };
    const result = await model(data, (connection) => rows(connection, observations('overburden')));
    expect(result.map((row) => [row.breakdown, row.value])).toEqual([
      ['rent_mkt', 35],
      ['total', 8],
      ['youth', 12],
    ]);
  });

  // Romania, 2025: 2.3 % of people rent at market price (56 % overburdened), 4.6 % at a reduced
  // price (11.7 %).
  const romania = {
    ilc_lvho07c: [
      { geo: 'RO', tenure: 'RENT_MKT', TIME_PERIOD: '2025', OBS_VALUE: 56 },
      { geo: 'RO', tenure: 'RENT_FR', TIME_PERIOD: '2025', OBS_VALUE: 11.7, OBS_FLAG: 'p' },
    ],
    ilc_lvho02: [
      { geo: 'RO', tenure: 'RENT_MKT', TIME_PERIOD: '2025', OBS_VALUE: 2.3 },
      { geo: 'RO', tenure: 'RENT_FR', TIME_PERIOD: '2025', OBS_VALUE: 4.6 },
    ],
  };
  const withRomania = <T>(use: (c: DuckDBConnection) => Promise<T>) =>
    withModel(romania, ['model'], use, ':memory:', ['RO']);

  it('weights the overburden of all tenants by the population in each kind of rent', async () => {
    const result = await withRomania((c) => rows(c, observations('overburden')));
    expect(result.find((row) => row.breakdown === 'rent')).toEqual({
      geo: 'RO',
      year: 2025,
      breakdown: 'rent',
      category: '_',
      value: 26.47,
      flags: 'p',
    });
  });

  it('warns when a tenure group is under 5 % of the population', async () => {
    const notes = await withRomania((c) =>
      rows(c, "SELECT breakdown, note FROM model.observation_note WHERE geo = 'RO' ORDER BY 1"),
    );
    expect(notes).toEqual([
      {
        breakdown: 'rent_fr',
        note: 'Solo el 4,6 % de la población está en este grupo: estimación con una muestra pequeña.',
      },
      {
        breakdown: 'rent_mkt',
        note: 'Solo el 2,3 % de la población está en este grupo: estimación con una muestra pequeña.',
      },
    ]);
  });

  it('explains the Dutch reclassification of social rent, with the comparable figure', async () => {
    const tenant = (tenure: string, year: string, value: number) => ({
      geo: 'NL',
      tenure,
      TIME_PERIOD: year,
      OBS_VALUE: value,
    });
    const data = {
      ilc_lvho07c: [
        tenant('RENT_MKT', '2020', 22.8),
        tenant('RENT_FR', '2020', 6.5),
        tenant('RENT_MKT', '2025', 39.5),
        tenant('RENT_FR', '2025', 12.9),
      ],
      ilc_lvho02: [
        tenant('RENT_MKT', '2020', 30.1),
        tenant('RENT_FR', '2020', 10),
        tenant('RENT_MKT', '2025', 5.5),
        tenant('RENT_FR', '2025', 25.7),
      ],
    };
    const notes = await withModel(
      data,
      ['model'],
      (connection) =>
        rows(
          connection,
          "SELECT year, breakdown, note FROM model.observation_note WHERE geo = 'NL' ORDER BY 1, 2",
        ),
      ':memory:',
      ['NL'],
    );
    const reclassified =
      'Desde 2021, el alquiler social cuenta como reducido y no como de mercado: no es comparable ' +
      'con años anteriores ni con otros países. Con todos los inquilinos: 17,6 %.';
    const before = 'Hasta 2020 incluye el alquiler social, que desde 2021 cuenta como reducido.';
    expect(notes).toEqual([
      { year: 2020, breakdown: 'rent_fr', note: before },
      { year: 2020, breakdown: 'rent_mkt', note: before },
      { year: 2025, breakdown: 'rent_fr', note: reclassified },
      { year: 2025, breakdown: 'rent_mkt', note: reclassified },
    ]);
  });

  it('stores tenure shares as categories, total rent included for the map', async () => {
    const data = {
      ilc_lvho02: ['TOTAL', 'OWN', 'OWN_L', 'RENT', 'RENT_FR'].map((tenure, i) => ({
        geo: 'ES',
        tenure,
        TIME_PERIOD: '2024',
        OBS_VALUE: i,
      })),
    };
    const result = await model(data, (connection) => rows(connection, observations('tenure')));
    expect(result.map((row) => [row.breakdown, row.category])).toEqual([
      ['total', 'own_l'],
      ['total', 'rent'],
      ['total', 'rent_fr'],
    ]);
  });

  it('names the sex and population breakdowns', async () => {
    const data = {
      yth_demo_030: ['T', 'F', 'M'].map((sex) => ({
        geo: 'ES',
        sex,
        TIME_PERIOD: '2024',
        OBS_VALUE: 30,
      })),
      demo_r_gind3: ['GROWRT', 'CNMIGRATRT'].map((indic_de) => ({
        geo: 'ES',
        indic_de,
        TIME_PERIOD: '2024',
        OBS_VALUE: 3,
      })),
    };
    const breakdowns = await model(data, (connection) =>
      rows(
        connection,
        "SELECT indicator_id, string_agg(breakdown, ' ' ORDER BY breakdown) AS b FROM model.observation GROUP BY ALL ORDER BY ALL",
      ),
    );
    expect(breakdowns).toEqual([
      { indicator_id: 'emancipation', b: 'men total women' },
      { indicator_id: 'popgrowth', b: 'migration total' },
    ]);
  });

  it('derives price vs income from national-currency income per inhabitant', async () => {
    // Income per inhabitant in national currency = MIO_NAC * EUR_HAB / MIO_EUR: 10000, then 12100.
    const income = (year: string, nac: number, eur: number, eurHab: number) => [
      { geo: 'ES', unit: 'MIO_NAC', TIME_PERIOD: year, OBS_VALUE: nac },
      { geo: 'ES', unit: 'MIO_EUR', TIME_PERIOD: year, OBS_VALUE: eur },
      {
        geo: 'ES',
        unit: 'EUR_HAB',
        TIME_PERIOD: year,
        OBS_VALUE: eurHab,
        OBS_FLAG: year === '2016' ? 'e' : null,
      },
    ];
    const data = {
      prc_hpi_a: [
        { geo: 'ES', TIME_PERIOD: '2015', OBS_VALUE: 50 },
        { geo: 'ES', TIME_PERIOD: '2016', OBS_VALUE: 60, OBS_FLAG: 'p' },
        { geo: 'ES', TIME_PERIOD: '2024', OBS_VALUE: 70 },
      ],
      nama_10r_2hhinc: [...income('2015', 1000, 1000, 10000), ...income('2016', 1320, 1200, 11000)],
    };
    expect(
      await model(data, (connection) => rows(connection, observations('price_income'))),
    ).toEqual([
      { geo: 'ES', year: 2015, breakdown: 'total', category: '_', value: 100, flags: null },
      { geo: 'ES', year: 2016, breakdown: 'total', category: '_', value: 99.17, flags: 'ep' },
    ]);
  });
});
