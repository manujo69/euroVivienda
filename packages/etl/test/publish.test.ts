import { catalogSchema, indicatorDataSchema } from '@eurovivienda/contract';
import type { IndicatorData, IndicatorMeta } from '@eurovivienda/contract';
import type { DuckDBConnection } from '@duckdb/node-api';
import { describe, expect, it } from 'vitest';
import { cleanData, rows, withModel } from './staging-fixture.ts';
import type { Row } from './staging-fixture.ts';

const publish = <T>(data: Record<string, Row[]>, use: (c: DuckDBConnection) => Promise<T>) =>
  withModel(data, ['model', 'publish'], use);

const breaksOf = async (connection: DuckDBConnection, indicator: string) => {
  const [row] = await rows(
    connection,
    `SELECT scale, breaks::VARCHAR AS breaks FROM publish.breaks WHERE indicator_id = '${indicator}'`,
  );
  return {
    scale: row?.scale,
    breaks: JSON.parse(row?.breaks as string) as Record<string, number[]>,
  };
};

const series = (values: number[], extra: Row = {}): Row[] =>
  values.map((value, i) => ({
    geo: 'ES',
    TIME_PERIOD: String(2015 + i),
    OBS_VALUE: value,
    ...extra,
  }));

describe('publish.breaks', () => {
  it('cuts sequential quantiles over the whole series of the countries', async () => {
    const data = {
      ...cleanData(),
      lfst_r_lfu3rt: [
        ...series([10, 20, 30, 40, 50, 60]),
        { geo: 'EU27_2020', TIME_PERIOD: '2015', OBS_VALUE: 99 },
      ],
    };
    expect(await publish(data, (c) => breaksOf(c, 'unemployment'))).toEqual({
      scale: 'sequential',
      breaks: { total: [20, 30, 40, 50] },
    });
  });

  it('centres a diverging scale on 0 when values fall on both sides', async () => {
    const data = { ...cleanData(), demo_r_gind3: series([-6, -3, 3, 6], { indic_de: 'GROWRT' }) };
    expect(await publish(data, (c) => breaksOf(c, 'popgrowth'))).toEqual({
      scale: 'diverging',
      breaks: { total: [-5, -4, 0, 4, 5] },
    });
  });

  it('cuts indices on the change since 2015, which is what the map paints', async () => {
    // Rebased to 100 ... 150, so the map paints 0 ... 50 % of change.
    const data = { ...cleanData(), prc_hpi_a: series([50, 55, 60, 65, 70, 75]) };
    expect(await publish(data, (c) => breaksOf(c, 'hpi'))).toEqual({
      scale: 'sequential',
      breaks: { total: [10, 20, 30, 40] },
    });
  });

  it('cuts compositions on the map category', async () => {
    const data = {
      ...cleanData(),
      ilc_lvho02: [
        ...series([10, 20, 30, 40, 50, 60], { tenure: 'RENT' }),
        ...series([90, 90, 90, 90, 90, 90], { tenure: 'OWN_NL' }),
      ],
    };
    expect(await publish(data, (c) => breaksOf(c, 'tenure'))).toEqual({
      scale: 'sequential',
      breaks: { total: [20, 30, 40, 50] },
    });
  });
});

describe('publish.catalog and publish.data', () => {
  const published = (c: DuckDBConnection) =>
    rows(
      c,
      'SELECT indicator_id, meta::VARCHAR AS meta, data::VARCHAR AS data FROM publish.catalog JOIN publish.data USING (indicator_id) ORDER BY 1',
    );

  const of = (result: Record<string, unknown>[], id: string) =>
    result.find((row) => row.indicator_id === id);

  it('publishes every indicator of the catalogue, overburden first', async () => {
    const order = await publish(cleanData(), (c) =>
      rows(c, 'SELECT indicator_id FROM publish.published ORDER BY position'),
    );
    expect(order.map((row) => row.indicator_id)).toEqual([
      'overburden',
      'hpi',
      'rent',
      'price_income',
      'tenure',
      'emancipation',
      'unemployment',
      'income',
      'tourism',
      'popgrowth',
    ]);
  });

  it('publishes every indicator as JSON that the contract accepts', async () => {
    const result = await publish(cleanData(), published);
    expect(result).toHaveLength(10);

    const catalog = catalogSchema.parse(
      result.map((row) => JSON.parse(row.meta as string) as unknown),
    );
    const tenure = catalog.find((meta) => meta.id === 'tenure');
    expect(tenure).toMatchObject({
      years: [2015, 2016],
      mapCategory: { id: 'rent', label: 'Inquilinos (mercado y reducido)' },
      source: {
        name: 'Eurostat',
        code: 'ilc_lvho02',
        url: 'https://ec.europa.eu/eurostat/databrowser/view/ilc_lvho02/default/table',
        lastUpdate: '2026-09-17',
      },
    });
    expect(catalog.find((meta) => meta.id === 'overburden')).not.toHaveProperty('categories');

    for (const [i, row] of result.entries()) {
      indicatorDataSchema(catalog[i] as IndicatorMeta).parse(JSON.parse(row.data as string));
    }
    expect(JSON.parse(of(result, 'tenure')?.data as string)).toMatchObject({
      ES: {
        '2016': { total: { v: { own_l: 20, own_nl: 20, rent_mkt: 20, rent_fr: 20, rent: 20 } } },
      },
    });
  });

  it('writes a flag only when there is one, rounding values to two decimals', async () => {
    const data = {
      ...cleanData(),
      ilc_lvho07a: [
        ...series([10.456, 9]),
        { geo: 'ES', TIME_PERIOD: '2017', OBS_VALUE: 8, OBS_FLAG: 'p' },
      ],
    };
    const result = await publish(data, published);
    const overburden = JSON.parse(of(result, 'overburden')?.data as string) as IndicatorData;
    expect(overburden).toMatchObject({
      ES: { '2015': { total: { v: 10.46 } }, '2017': { total: { v: 8, f: 'p' } } },
    });
    expect(overburden.ES?.['2015']?.total).not.toHaveProperty('f');
  });

  it('writes the note of a value, and only where there is one', async () => {
    const data = {
      ...cleanData(),
      ilc_lvho07c: [
        ...(cleanData().ilc_lvho07c ?? []),
        { geo: 'RO', tenure: 'RENT_MKT', TIME_PERIOD: '2016', OBS_VALUE: 56 },
      ],
      ilc_lvho02: [
        ...(cleanData().ilc_lvho02 ?? []),
        { geo: 'RO', tenure: 'RENT_MKT', TIME_PERIOD: '2016', OBS_VALUE: 2.3 },
      ],
    };
    const result = await withModel(data, ['model', 'publish'], published, ':memory:', ['RO']);
    const overburden = JSON.parse(of(result, 'overburden')?.data as string) as IndicatorData;
    expect(overburden.RO?.['2016']?.rent_mkt).toEqual({
      v: 56,
      n: 'Solo el 2,3 % de la población está en este grupo: estimación con una muestra pequeña.',
    });
    expect(overburden.ES?.['2016']?.rent_mkt).not.toHaveProperty('n');
  });
});

describe('publish.geo_nuts0', () => {
  it('holds the EU countries without their outermost regions', async () => {
    const [row] = await publish(cleanData(), (c) =>
      rows(c, 'SELECT geojson::VARCHAR AS geojson FROM publish.geo_nuts0'),
    );
    const collection = JSON.parse(row?.geojson as string) as {
      features: { properties: { code: string }; geometry: { type: string } }[];
    };
    expect(collection.features.map((feature) => feature.properties.code)).toEqual(['ES']);
    expect(collection.features[0]?.geometry.type).toBe('Polygon');
  });
});

describe('publish.geo_nuts2', () => {
  it('holds the EU NUTS 2 regions, named, without the outermost ones', async () => {
    const [row] = await publish(cleanData(), (c) =>
      rows(c, 'SELECT geojson::VARCHAR AS geojson FROM publish.geo_nuts2'),
    );
    const collection = JSON.parse(row?.geojson as string) as {
      features: { properties: { code: string; name: string }; geometry: { type: string } }[];
    };
    expect(collection.features.map((feature) => feature.properties)).toEqual([
      { code: 'ES30', name: 'Comunidad de Madrid' },
      { code: 'ES51', name: 'Cataluña' },
    ]);
    expect(collection.features[0]?.geometry.type).toBe('Polygon');
  });
});

describe('publish.geo_context', () => {
  it('holds the non-EU countries around the EU, cut at a frame 300 km beyond it', async () => {
    const [row] = await publish(cleanData(), (c) =>
      rows(c, 'SELECT geojson::VARCHAR AS geojson FROM publish.geo_context'),
    );
    const collection = JSON.parse(row?.geojson as string) as {
      features: { properties: { code: string }; geometry: { coordinates: number[][][] } }[];
    };
    expect(collection.features.map((feature) => feature.properties.code)).toEqual(['AD', 'MA']);
    // Mainland Spain starts at y = 2 000 km: Morocco is cut at 1 700 km.
    const morocco = collection.features[1]?.geometry.coordinates[0] ?? [];
    expect(Math.min(...morocco.map(([, y]) => y ?? 0))).toBe(1700000);
  });
});
