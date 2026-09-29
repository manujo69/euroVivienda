import { DuckDBInstance } from '@duckdb/node-api';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { build, latestRawDir } from '../src/build.ts';
import { allTargets, download } from '../src/download.ts';
import { sources } from '../src/sources.ts';

const square = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

function geoJson(properties: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::3035' } },
    features: [{ type: 'Feature', properties, geometry: square }],
  });
}

/** One observation per source and one feature per layer, served as the real download would be. */
function fixtureBody(url: string): Buffer {
  const source = sources.find((candidate) => url.includes(`/data/${candidate.code}/`));
  if (source) {
    const header = [
      'DATAFLOW',
      'LAST UPDATE',
      ...source.dimensions,
      'TIME_PERIOD',
      'OBS_VALUE',
      'OBS_FLAG',
      'CONF_STATUS',
    ];
    const codes = source.dimensions.map((dimension) =>
      dimension === 'geo' ? 'ES' : (source.filters[dimension]?.[0] ?? 'T'),
    );
    const row = ['ESTAT:X(1.0)', '17/09/26 23:00:00', ...codes, '2024', '12.5', 'p', ''];
    return gzipSync(`${header.join(',')}\n${row.join(',')}\n`);
  }
  if (url.includes('CNTR_RG')) return Buffer.from(geoJson({ CNTR_ID: 'NO', NAME_ENGL: 'Norway' }));
  return Buffer.from(
    geoJson({ NUTS_ID: 'ES', LEVL_CODE: 0, CNTR_CODE: 'ES', NAME_LATN: 'España' }),
  );
}

async function query(database: string, sql: string): Promise<Record<string, unknown>[]> {
  const instance = await DuckDBInstance.create(database);
  const connection = await instance.connect();
  try {
    return (await connection.runAndReadAll(sql)).getRowObjectsJS();
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

describe('build', () => {
  let root: string;
  let raw: string;
  let database: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'etl-build-'));
    raw = await download(allTargets(), {
      root,
      now: new Date('2026-09-29T12:00:00Z'),
      fetch: (url) => Promise.resolve(new Response(fixtureBody(url))),
    });
    database = join(root, 'vivienda.duckdb');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('loads every source and layer into staging without transforming it', async () => {
    await build({ raw, database, layers: ['staging'] });

    const tables = await query(
      database,
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'staging' ORDER BY 1",
    );
    expect(tables.map((row) => row.table_name)).toEqual(
      [...sources.map((source) => source.code), 'geo_countries', 'geo_nuts'].sort(),
    );
    expect(
      await query(database, 'SELECT sex, OBS_VALUE, OBS_FLAG FROM staging.ilc_lvho07a'),
    ).toEqual([{ sex: 'T', OBS_VALUE: 12.5, OBS_FLAG: 'p' }]);
    expect(
      await query(
        database,
        'SELECT NUTS_ID, count(*)::INTEGER AS n FROM staging.geo_nuts GROUP BY ALL',
      ),
    ).toEqual([{ NUTS_ID: 'ES', n: 2 }]);
  });

  it('records one snapshot per raw file, also when rebuilt', async () => {
    await build({ raw, database, layers: ['staging'] });
    await build({ raw, database, layers: ['staging'] });

    const snapshots = await query(
      database,
      'SELECT dataset, file, sha256, row_count, last_update::VARCHAR AS last_update FROM model.source_snapshot',
    );
    expect(snapshots).toHaveLength(allTargets().length);
    expect(snapshots.find((row) => row.dataset === 'prc_hpi_a')).toMatchObject({
      file: 'prc_hpi_a.csv.gz',
      row_count: 1,
      last_update: '2026-09-17 23:00:00',
    });
    expect(snapshots.every((row) => String(row.sha256).length === 64)).toBe(true);
  });

  it('names the SQL file that failed', async () => {
    await rm(join(raw, 'ilc_lvho02.csv.gz'));
    await expect(build({ raw, database, layers: ['staging'] })).rejects.toThrow(/ilc_lvho02\.sql/);
  });
});

describe('latestRawDir', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'etl-raw-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('picks the newest folder with a manifest, skipping incomplete downloads', async () => {
    for (const day of ['2026-08-31', '2026-09-01', '2026-09-15']) {
      await mkdir(join(root, day));
    }
    await writeFile(join(root, '2026-08-31', 'manifest.json'), '{}');
    await writeFile(join(root, '2026-09-01', 'manifest.json'), '{}');

    expect(await latestRawDir(root)).toBe(join(root, '2026-09-01'));
  });

  it('fails clearly when there is no complete download', async () => {
    await expect(latestRawDir(root)).rejects.toThrow(/no complete download.*etl download/);
  });
});
