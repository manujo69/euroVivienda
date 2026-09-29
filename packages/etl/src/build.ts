// `etl build`: rebuilds the DuckDB database from one raw download. Node only runs the SQL files.

import { DuckDBInstance } from '@duckdb/node-api';
import type { DuckDBConnection } from '@duckdb/node-api';
import { access, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const SQL = join(import.meta.dirname, '../sql');
const LAYERS = ['staging'];

/** Newest dated folder whose download finished, i.e. that has a manifest. */
export async function latestRawDir(root: string): Promise<string> {
  const days = (await readdir(root).catch(() => [])).filter((name) =>
    /^\d{4}-\d\d-\d\d$/.test(name),
  );
  for (const day of days.sort().reverse()) {
    const dir = join(root, day);
    if (await exists(join(dir, 'manifest.json'))) return dir;
  }
  throw new Error(`no complete download in ${root}; run etl download first`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface BuildOptions {
  /** Dated raw folder with its manifest. */
  readonly raw: string;
  /** Database file, deleted and created again. */
  readonly database: string;
}

export async function build({ raw, database }: BuildOptions): Promise<void> {
  await rm(database, { force: true });
  await rm(`${database}.wal`, { force: true });
  // Older storage versions drop the CRS of GEOMETRY columns.
  const instance = await DuckDBInstance.create(database, {
    storage_compatibility_version: 'latest',
  });
  const connection = await instance.connect();
  try {
    await connection.run(`SET VARIABLE raw = '${raw.replaceAll("'", "''")}'`);
    for (const layer of LAYERS) await runSqlFolder(connection, join(SQL, layer));
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

async function runSqlFolder(connection: DuckDBConnection, dir: string): Promise<void> {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      await connection.run(await readFile(join(dir, file), 'utf8'));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`${file}: ${reason}`, { cause: error });
    }
  }
}
