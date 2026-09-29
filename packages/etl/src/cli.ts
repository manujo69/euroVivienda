// Entry point: `pnpm etl download` and `pnpm etl build`.

import { join } from 'node:path';
import { build, latestRawDir } from './build.ts';
import { allTargets, download } from './download.ts';

const DATA = join(import.meta.dirname, '../../../data');
const RAW = join(DATA, 'raw');
const DATABASE = join(DATA, 'vivienda.duckdb');

const [command] = process.argv.slice(2);

try {
  if (command === 'download') {
    const dir = await download(allTargets(), {
      root: RAW,
      onFile: (entry) => {
        console.log(`${entry.name}  ${entry.bytes} B  updated ${entry.lastUpdate ?? 'unknown'}`);
      },
    });
    console.log(`Saved in ${dir}`);
  } else if (command === 'build') {
    const raw = await latestRawDir(RAW);
    await build({ raw, database: DATABASE });
    console.log(`Built ${DATABASE} from ${raw}`);
  } else {
    throw new Error('usage: etl download | etl build');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
