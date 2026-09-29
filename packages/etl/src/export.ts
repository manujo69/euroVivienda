// `etl export`: reads the publish views and writes the static files the app loads. Nothing is
// written unless every file passes the contract and the size budget.

import { DuckDBInstance } from '@duckdb/node-api';
import { catalogSchema, indicatorDataSchema, indicatorMetaSchema } from '@eurovivienda/contract';
import type { IndicatorMeta } from '@eurovivienda/contract';
import mapshaper from 'mapshaper';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Size budget of the NUTS 0 topology with its non-EU context, in bytes (spec.md, «Riesgos»):
 * 65 KB in September 2026, about 21 KB gzipped.
 */
export const NUTS0_BUDGET = 80 * 1024;

export interface ExportOptions {
  /** Database built by `etl build`. */
  readonly database: string;
  /** Public folder of the app: catalog.json, data/ and geo/ are written there. */
  readonly out: string;
}

interface Issues {
  readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[];
}

function check<T>(
  label: string,
  result: { success: true; data: T } | { success: false; error: Issues },
): T {
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`${label} breaks the contract: ${issues.join('; ')}`);
}

export async function exportPublished({ database, out }: ExportOptions): Promise<string[]> {
  const instance = await DuckDBInstance.create(database, { access_mode: 'READ_ONLY' });
  const connection = await instance.connect();
  let published: { meta: IndicatorMeta; data: unknown }[];
  let geojson: { nuts0: string; context: string };
  try {
    await connection.run('LOAD spatial');
    const rows = await connection.runAndReadAll(`
      SELECT c.indicator_id, c.meta::VARCHAR AS meta, d.data::VARCHAR AS data
      FROM publish.catalog AS c JOIN publish.data AS d USING (indicator_id)
      ORDER BY c.indicator_id`);
    published = rows.getRowObjectsJS().map((row) => {
      const { indicator_id: id, meta: metaJson, data: dataJson } = row as Record<string, string>;
      const meta = check(`${id}`, indicatorMetaSchema.safeParse(JSON.parse(`${metaJson}`)));
      const data = check(
        `data of ${id}`,
        indicatorDataSchema(meta).safeParse(JSON.parse(`${dataJson}`)),
      );
      return { meta, data };
    });
    const geo = await connection.runAndReadAll(`
      SELECT n.geojson::VARCHAR, c.geojson::VARCHAR
      FROM publish.geo_nuts0 AS n, publish.geo_context AS c`);
    const [nuts0, context] = geo.getRows()[0] ?? [];
    if (typeof nuts0 !== 'string' || typeof context !== 'string') {
      throw new Error('publish.geo_nuts0 or publish.geo_context is empty');
    }
    geojson = { nuts0, context };
  } finally {
    connection.closeSync();
    instance.closeSync();
  }

  const catalog = check('catalog', catalogSchema.safeParse(published.map(({ meta }) => meta)));
  // Geometries arrive projected: mapshaper only builds the topology and quantises it (~1 km grid).
  // EU countries and their non-EU context share one topology, so common borders line up.
  const topology = await mapshaper.applyCommands(
    '-i nuts0.json context.json combine-files ' +
      '-o nuts0.json format=topojson quantization=10000 id-field=code',
    { 'nuts0.json': geojson.nuts0, 'context.json': geojson.context },
  );
  const nuts0 = String(topology['nuts0.json']);
  if (nuts0.length > NUTS0_BUDGET) {
    throw new Error(`geo/nuts0.json is ${nuts0.length} bytes, over its ${NUTS0_BUDGET} budget`);
  }

  // data/ and geo/ belong to the export: stale files of retired indicators go.
  await rm(join(out, 'data'), { recursive: true, force: true });
  await rm(join(out, 'geo'), { recursive: true, force: true });
  await mkdir(join(out, 'data'), { recursive: true });
  await mkdir(join(out, 'geo'), { recursive: true });
  const files: Record<string, string> = {
    'catalog.json': `${JSON.stringify(catalog, null, 2)}\n`,
    'geo/nuts0.json': `${nuts0}\n`,
  };
  for (const { meta, data } of published)
    files[`data/${meta.id}.json`] = `${JSON.stringify(data)}\n`;
  for (const [file, content] of Object.entries(files)) await writeFile(join(out, file), content);
  return Object.keys(files);
}
