// `etl download`: raw files and manifest in data/raw/YYYY-MM-DD/.

import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { gunzipSync } from 'node:zlib';
import { countriesUrl, nutsUrl } from './geometries.ts';
import { downloadUrl, sources } from './sources.ts';
import type { Source } from './sources.ts';

export interface Inspection {
  /** ISO date of the last update declared by the publisher, if any. */
  readonly lastUpdate: string | null;
}

export interface Target {
  readonly name: string;
  readonly url: string;
  readonly file: string;
  /** Throws if the body does not have the expected format. */
  inspect(body: Uint8Array, headers: Headers): Inspection;
}

export interface ManifestEntry extends Inspection {
  readonly name: string;
  readonly url: string;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface Manifest {
  readonly downloadedAt: string;
  readonly files: readonly ManifestEntry[];
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type Sleep = (ms: number) => Promise<unknown>;

export interface FetchOptions {
  readonly fetch?: Fetch;
  readonly sleep?: Sleep;
}

const ATTEMPTS = 4;
const FIRST_WAIT_MS = 1000;
const TIMEOUT_MS = 120_000;

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { fetch = globalThis.fetch, sleep = setTimeout } = options;
  for (let attempt = 1; ; attempt++) {
    let reason: string;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) return response;
      reason = `HTTP ${response.status}`;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`${url}: ${reason} ${faultOf(await response.text())}`.trimEnd());
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(url)) throw error;
      reason = error instanceof Error ? error.message : String(error);
    }
    if (attempt === ATTEMPTS) throw new Error(`${url}: ${reason} after ${ATTEMPTS} attempts`);
    await sleep(FIRST_WAIT_MS * 2 ** (attempt - 1));
  }
}

/** Eurostat explains rejected queries in an XML fault. */
function faultOf(body: string): string {
  return /<faultstring>(.*?)<\/faultstring>/s.exec(body)?.[1] ?? '';
}

export function inspectEurostat(source: Source, body: Uint8Array): Inspection {
  if (body[0] !== 0x1f || body[1] !== 0x8b) throw new Error(`${source.code}: not a gzip file`);
  const [header = '', firstRow] = gunzipSync(body).toString('utf8').split('\n', 2);
  const expected = [
    'DATAFLOW',
    'LAST UPDATE',
    ...source.dimensions,
    'TIME_PERIOD',
    'OBS_VALUE',
    'OBS_FLAG',
    'CONF_STATUS',
  ].join(',');
  if (header.trimEnd() !== expected) {
    throw new Error(`${source.code}: unexpected columns ${header}, expected ${expected}`);
  }
  // LAST UPDATE comes as dd/mm/yy HH:MM:SS.
  const stamp = /^(\d\d)\/(\d\d)\/(\d\d) (\d\d:\d\d:\d\d)$/.exec(firstRow?.split(',')[1] ?? '');
  if (!stamp) throw new Error(`${source.code}: no observations or unreadable LAST UPDATE`);
  const [, day, month, year, time] = stamp;
  return { lastUpdate: `20${year}-${month}-${day}T${time}` };
}

export function inspectGeoJson(name: string, body: Uint8Array, headers: Headers): Inspection {
  const geo = JSON.parse(Buffer.from(body).toString('utf8')) as {
    type?: string;
    crs?: { properties?: { name?: string } };
    features?: unknown[];
  };
  if (geo.type !== 'FeatureCollection' || !geo.features?.length) {
    throw new Error(`${name}: not a non-empty GeoJSON FeatureCollection`);
  }
  const crs = geo.crs?.properties?.name ?? 'none';
  if (!crs.endsWith('EPSG::3035')) throw new Error(`${name}: expected EPSG:3035, got ${crs}`);
  const modified = headers.get('last-modified');
  return { lastUpdate: modified ? new Date(modified).toISOString() : null };
}

export function sourceTarget(source: Source): Target {
  return {
    name: source.code,
    url: downloadUrl(source),
    file: `${source.code}.csv.gz`,
    inspect: (body) => inspectEurostat(source, body),
  };
}

export function geoJsonTarget(url: string): Target {
  const file = basename(new URL(url).pathname);
  const name = file.replace(/\.geojson$/, '');
  return { name, url, file, inspect: (body, headers) => inspectGeoJson(name, body, headers) };
}

/** Every Eurostat source and GISCO layer the ETL needs. */
export function allTargets(): Target[] {
  return [
    ...sources.map(sourceTarget),
    geoJsonTarget(nutsUrl(0)),
    geoJsonTarget(nutsUrl(2)),
    geoJsonTarget(countriesUrl()),
  ];
}

export interface DownloadOptions extends FetchOptions {
  /** Parent of the dated folders, normally data/raw. */
  readonly root: string;
  readonly now?: Date;
  readonly onFile?: (entry: ManifestEntry) => void;
}

/** Downloads every target and returns the dated folder. The manifest only exists if all passed. */
export async function download(
  targets: readonly Target[],
  options: DownloadOptions,
): Promise<string> {
  const now = options.now ?? new Date();
  const dir = join(options.root, now.toISOString().slice(0, 10));
  await mkdir(dir, { recursive: true });
  await rm(join(dir, 'manifest.json'), { force: true });

  const files: ManifestEntry[] = [];
  for (const target of targets) {
    const response = await fetchWithRetry(target.url, options);
    const body = new Uint8Array(await response.arrayBuffer());
    const { lastUpdate } = target.inspect(body, response.headers);
    await writeFile(join(dir, target.file), body);
    const entry: ManifestEntry = {
      name: target.name,
      url: target.url,
      file: target.file,
      lastUpdate,
      sha256: createHash('sha256').update(body).digest('hex'),
      bytes: body.byteLength,
    };
    files.push(entry);
    options.onFile?.(entry);
  }

  const manifest: Manifest = { downloadedAt: now.toISOString(), files };
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return dir;
}
