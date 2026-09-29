// Entry point: `pnpm etl download`, `pnpm etl build` and `pnpm etl export`.

import { join } from 'node:path';
import { build, latestRawDir } from './build.ts';
import { allTargets, download } from './download.ts';
import { exportPublished } from './export.ts';

const DATA = join(import.meta.dirname, '../../../data');
const RAW = join(DATA, 'raw');
const DATABASE = join(DATA, 'vivienda.duckdb');
const PUBLIC = join(import.meta.dirname, '../../../apps/angular/public');

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
  } else if (command === 'export') {
    const files = await exportPublished({ database: DATABASE, out: PUBLIC });
    console.log(`Wrote ${files.join(', ')} in ${PUBLIC}`);
  } else {
    throw new Error('usage: etl download | etl build | etl export');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
