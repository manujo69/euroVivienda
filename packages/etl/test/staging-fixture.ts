// Tiny hand-written staging database for the model and quality tests.

import { DuckDBInstance } from '@duckdb/node-api';
import type { DuckDBConnection } from '@duckdb/node-api';
import { join } from 'node:path';
import { runSqlFolder } from '../src/build.ts';
import { sources } from '../src/sources.ts';

export type Row = Record<string, string | number | null | undefined>;

const SQL = join(import.meta.dirname, '../sql');

const literal = (value: string | number | null | undefined) =>
  value === null || value === undefined
    ? 'NULL'
    : typeof value === 'number'
      ? String(value)
      : `'${value}'`;

/** Staging tables for every source; each row may omit dimensions left at their first filter code. */
export async function stage(connection: DuckDBConnection, data: Record<string, Row[]>) {
  await connection.run(`
    CREATE SCHEMA staging;
    CREATE SCHEMA model;
    CREATE TABLE staging.geo_nuts (NUTS_ID VARCHAR, LEVL_CODE INTEGER, CNTR_CODE VARCHAR,
      NAME_LATN VARCHAR, EU_STAT VARCHAR);
    INSERT INTO staging.geo_nuts VALUES
      ('ES', 0, 'ES', 'España', 'T'),
      ('ES30', 2, 'ES', 'Comunidad de Madrid', 'T'),
      ('ES51', 2, 'ES', 'Cataluña', 'T'),
      ('ES70', 2, 'ES', 'Canarias', 'T'),
      ('NO', 0, 'NO', 'Norge', 'F');
  `);
  for (const source of sources) {
    const columns = [...source.dimensions, 'TIME_PERIOD', 'OBS_VALUE', 'OBS_FLAG'];
    await connection.run(`
      CREATE TABLE staging.${source.code} (DATAFLOW VARCHAR, "LAST UPDATE" TIMESTAMP,
        ${source.dimensions.map((dimension) => `${dimension} VARCHAR`).join(', ')},
        TIME_PERIOD VARCHAR, OBS_VALUE DOUBLE, OBS_FLAG VARCHAR, CONF_STATUS VARCHAR)`);
    for (const row of data[source.code] ?? []) {
      const values = columns.map((column) =>
        literal(row[column] ?? source.filters[column]?.[0] ?? null),
      );
      await connection.run(
        `INSERT INTO staging.${source.code} (${columns.join(', ')}) VALUES (${values.join(', ')})`,
      );
    }
  }
}

/** Opens an in-memory database, stages `data`, runs the given SQL layers and hands over. */
export async function withModel<T>(
  data: Record<string, Row[]>,
  layers: readonly string[],
  use: (connection: DuckDBConnection) => Promise<T>,
): Promise<T> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    await stage(connection, data);
    for (const layer of layers) await runSqlFolder(connection, join(SQL, layer));
    return await use(connection);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

export async function rows(connection: DuckDBConnection, sql: string) {
  return (await connection.runAndReadAll(sql)).getRowObjectsJS();
}

const years = (geo: string, values: Record<string, number>, extra: Row = {}): Row[] =>
  Object.entries(values).map(([year, value]) => ({
    geo,
    TIME_PERIOD: year,
    OBS_VALUE: value,
    ...extra,
  }));

const regional = (values: Record<string, number>): Row[] =>
  ['ES', 'ES30', 'ES51'].flatMap((geo) => years(geo, values));

/** One plausible series per indicator for Spain, its regions and the EU: passes every check. */
export function cleanData(): Record<string, Row[]> {
  const index = { '2015': 80, '2016': 88 };
  return {
    prc_hpi_a: [...years('ES', index), ...years('EU27_2020', index)],
    prc_hicp_ainr: [...years('ES', index), ...years('EU27_2020', index)],
    nama_10r_2hhinc: ['ES', 'ES30', 'ES51', 'EU27_2020'].flatMap((geo) => [
      ...years(geo, { '2015': 16000, '2016': 16500 }, { unit: 'PPS_EU27_2020_HAB' }),
      ...years(geo, { '2015': 15000, '2016': 15500 }, { unit: 'EUR_HAB' }),
      ...years(geo, { '2015': 700000, '2016': 720000 }, { unit: 'MIO_NAC' }),
      ...years(geo, { '2015': 700000, '2016': 720000 }, { unit: 'MIO_EUR' }),
    ]),
    ilc_lvho07a: years('ES', { '2015': 10, '2016': 9 }),
    ilc_lvho07c: years('ES', { '2015': 10, '2016': 9 }),
    ilc_lvho02: ['OWN_L', 'OWN_NL', 'RENT_MKT', 'RENT_FR', 'RENT'].flatMap((tenure) =>
      years('ES', { '2015': 20, '2016': 20 }, { tenure }),
    ),
    yth_demo_030: years('ES', { '2015': 29, '2016': 29.5 }, { sex: 'T' }),
    lfst_r_lfu3rt: regional({ '2015': 20, '2016': 18 }),
    tour_occ_nin2: regional({ '2015': 9000, '2016': 9500 }),
    demo_r_gind3: regional({ '2015': 1, '2016': 2 }),
  };
}
