import { DuckDBInstance } from '@duckdb/node-api';
import { catalogSchema } from '@eurovivienda/contract';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportPublished } from '../src/export.ts';
import { cleanData, withModel } from './staging-fixture.ts';

describe('exportPublished', () => {
  let root: string;
  let database: string;
  let out: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'etl-export-'));
    database = join(root, 'vivienda.duckdb');
    out = join(root, 'public');
    await withModel(
      cleanData(),
      ['model', 'quality', 'publish'],
      () => Promise.resolve(),
      database,
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const read = async (file: string) =>
    JSON.parse(await readFile(join(out, file), 'utf8')) as unknown;

  it('writes the catalogue, one data file per indicator and the NUTS 0 topology', async () => {
    await mkdir(join(out, 'data'), { recursive: true });
    await writeFile(join(out, 'data', 'retired.json'), '{}');

    await exportPublished({ database, out });

    expect(catalogSchema.parse(await read('catalog.json')).map((meta) => meta.id)).toEqual([
      'overburden',
      'tenure',
    ]);
    expect((await readdir(join(out, 'data'))).sort()).toEqual(['overburden.json', 'tenure.json']);
    expect(await read('data/overburden.json')).toMatchObject({
      ES: { '2015': { total: { v: 10 } } },
    });
    const topology = (await read('geo/nuts0.json')) as {
      type: string;
      objects: Record<string, { geometries: { id: string; type: string }[] }>;
    };
    expect(topology.type).toBe('Topology');
    expect(topology.objects.nuts0?.geometries.map((g) => [g.id, g.type])).toEqual([
      ['ES', 'Polygon'],
    ]);
    // Non-EU countries share the topology, so common borders line up.
    expect(topology.objects.context?.geometries.map((g) => g.id)).toEqual(['AD', 'MA']);
  });

  it('writes nothing when the output breaks the contract', async () => {
    const instance = await DuckDBInstance.create(database);
    const connection = await instance.connect();
    await connection.run("UPDATE model.indicator SET unit = '' WHERE id = 'tenure'");
    connection.closeSync();
    instance.closeSync();

    await expect(exportPublished({ database, out })).rejects.toThrow(/tenure/);
    await expect(readdir(out)).rejects.toThrow();
  });
});
