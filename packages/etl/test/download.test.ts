import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  allTargets,
  download,
  fetchWithRetry,
  geoJsonTarget,
  inspectEurostat,
  inspectGeoJson,
  sourceTarget,
} from '../src/download.ts';
import type { Manifest } from '../src/download.ts';
import { sources } from '../src/sources.ts';
import type { Source } from '../src/sources.ts';

const source: Source = {
  code: 'ilc_lvho07c',
  title: 'Housing cost overburden rate by tenure status',
  dimensions: ['freq', 'unit', 'tenure', 'geo'],
  filters: { freq: ['A'], unit: ['PC'] },
};

const HEADER =
  'DATAFLOW,LAST UPDATE,freq,unit,tenure,geo,TIME_PERIOD,OBS_VALUE,OBS_FLAG,CONF_STATUS';
const ROW = 'ESTAT:ILC_LVHO07C(1.0),17/09/26 23:00:00,A,PC,OWN_L,AL,2017,33.5,,';
const eurostatCsv = (header = HEADER) => gzipSync(`${header}\n${ROW}\n`);

const geoJson = (crs = 'urn:ogc:def:crs:EPSG::3035') =>
  Buffer.from(
    JSON.stringify({
      type: 'FeatureCollection',
      crs: { type: 'name', properties: { name: crs } },
      features: [{ type: 'Feature', properties: { NUTS_ID: 'ES' }, geometry: null }],
    }),
  );

const noSleep = () => Promise.resolve();

describe('inspectEurostat', () => {
  it('reads the last update from the first row', () => {
    expect(inspectEurostat(source, eurostatCsv())).toEqual({ lastUpdate: '2026-09-17T23:00:00' });
  });

  it('fails clearly when Eurostat changes the dimensions', () => {
    const header = HEADER.replace('tenure,', 'tenure,age,');
    expect(() => inspectEurostat(source, eurostatCsv(header))).toThrow(
      /ilc_lvho07c: unexpected columns.*age/,
    );
  });

  it('rejects a body that is not gzip', () => {
    expect(() => inspectEurostat(source, Buffer.from('<?xml version="1.0"?>'))).toThrow(
      /ilc_lvho07c: not a gzip/,
    );
  });
});

describe('inspectGeoJson', () => {
  const headers = new Headers({ 'last-modified': 'Fri, 25 Sep 2026 12:41:17 GMT' });

  it('takes the last update from Last-Modified', () => {
    expect(inspectGeoJson('NUTS_0', geoJson(), headers)).toEqual({
      lastUpdate: '2026-09-25T12:41:17.000Z',
    });
  });

  it('rejects geometries in another projection', () => {
    expect(() =>
      inspectGeoJson('NUTS_0', geoJson('urn:ogc:def:crs:OGC:1.3:CRS84'), headers),
    ).toThrow(/NUTS_0: expected EPSG:3035/);
  });
});

describe('fetchWithRetry', () => {
  it('retries server errors with growing waits', async () => {
    const statuses = [503, 502, 200];
    const waits: number[] = [];
    const response = await fetchWithRetry('https://example.test/a', {
      fetch: () => Promise.resolve(new Response('ok', { status: statuses.shift() })),
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    expect(await response.text()).toBe('ok');
    expect(waits).toEqual([1000, 2000]);
  });

  it('retries network errors and gives up after the last attempt', async () => {
    let calls = 0;
    const failing = fetchWithRetry('https://example.test/a', {
      fetch: () => {
        calls += 1;
        return Promise.reject(new TypeError('fetch failed'));
      },
      sleep: noSleep,
    });
    await expect(failing).rejects.toThrow(/https:\/\/example.test\/a.*fetch failed/);
    expect(calls).toBe(4);
  });

  it('does not retry client errors and reports the Eurostat fault', async () => {
    let calls = 0;
    const fault =
      '<S:Fault><faultcode>150</faultcode><faultstring>UNIT=XX not allowed</faultstring></S:Fault>';
    const failing = fetchWithRetry('https://example.test/a', {
      fetch: () => {
        calls += 1;
        return Promise.resolve(new Response(fault, { status: 400 }));
      },
      sleep: noSleep,
    });
    await expect(failing).rejects.toThrow(/HTTP 400.*UNIT=XX not allowed/);
    expect(calls).toBe(1);
  });
});

describe('allTargets', () => {
  it('covers every source and GISCO layer, each in its own file', () => {
    const all = allTargets();
    expect(all).toHaveLength(sources.length + 3);
    expect(new Set(all.map((target) => target.file)).size).toBe(all.length);
    expect(new Set(all.map((target) => target.name)).size).toBe(all.length);
  });
});

describe('download', () => {
  let root: string;
  const now = new Date('2026-09-29T12:00:00Z');

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'etl-download-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const csv = eurostatCsv();
  const bodies: Record<string, Buffer> = {
    'https://example.test/eurostat': csv,
    'https://example.test/nuts.geojson': geoJson(),
  };
  const fakeFetch = (url: string) =>
    Promise.resolve(
      new Response(bodies[url], {
        headers: { 'last-modified': 'Fri, 25 Sep 2026 12:41:17 GMT' },
      }),
    );
  const targets = [
    { ...sourceTarget(source), url: 'https://example.test/eurostat' },
    { ...geoJsonTarget('https://example.test/nuts.geojson') },
  ];

  it('saves every file under the date and writes the manifest last', async () => {
    const dir = await download(targets, { root, now, fetch: fakeFetch, sleep: noSleep });

    expect(dir).toBe(join(root, '2026-09-29'));
    expect((await readdir(dir)).sort()).toEqual([
      'ilc_lvho07c.csv.gz',
      'manifest.json',
      'nuts.geojson',
    ]);
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Manifest;
    expect(manifest.downloadedAt).toBe('2026-09-29T12:00:00.000Z');
    expect(manifest.files[0]).toEqual({
      name: 'ilc_lvho07c',
      url: 'https://example.test/eurostat',
      file: 'ilc_lvho07c.csv.gz',
      lastUpdate: '2026-09-17T23:00:00',
      sha256: createHash('sha256').update(csv).digest('hex'),
      bytes: csv.length,
    });
    expect(manifest.files[1]).toMatchObject({ name: 'nuts', file: 'nuts.geojson' });
  });

  it('leaves no manifest, not even an earlier one, when a file fails its check', async () => {
    await download(targets, { root, now, fetch: fakeFetch, sleep: noSleep });
    const broken = [
      ...targets,
      { ...sourceTarget(source), url: 'https://example.test/nuts.geojson' },
    ];
    await expect(download(broken, { root, now, fetch: fakeFetch, sleep: noSleep })).rejects.toThrow(
      /not a gzip/,
    );
    expect(await readdir(join(root, '2026-09-29'))).not.toContain('manifest.json');
  });
});
