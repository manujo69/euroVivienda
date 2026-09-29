import { describe, expect, it } from 'vitest';
import { attribution, downloadUrl, pageUrl, sources } from '../src/sources.ts';
import type { Source } from '../src/sources.ts';

const overburdenByTenure: Source = {
  code: 'ilc_lvho07c',
  title: 'Housing cost overburden rate by tenure status',
  dimensions: ['freq', 'unit', 'tenure', 'geo'],
  filters: { freq: ['A'], unit: ['PC'] },
};

describe('downloadUrl', () => {
  it('builds an SDMX-CSV request whose key follows the dimension order', () => {
    expect(downloadUrl(overburdenByTenure)).toBe(
      'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/ilc_lvho07c/A.PC..' +
        '?format=SDMX-CSV&compressed=true&startPeriod=2015',
    );
  });

  it('joins several codes of one dimension with +', () => {
    const source = { ...overburdenByTenure, filters: { tenure: ['TOTAL', 'RENT_MKT'] } };
    expect(downloadUrl(source)).toContain('/ilc_lvho07c/..TOTAL+RENT_MKT.?');
  });
});

describe('pageUrl and attribution', () => {
  it('point to the Eurostat data browser and name the dataset', () => {
    expect(pageUrl(overburdenByTenure)).toBe(
      'https://ec.europa.eu/eurostat/databrowser/view/ilc_lvho07c/default/table',
    );
    expect(attribution(overburdenByTenure)).toBe('Fuente: Eurostat (ilc_lvho07c)');
  });
});

describe('sources', () => {
  it('lists each dataset once', () => {
    const codes = sources.map((source) => source.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(sources)('$code filters only on its own dimensions, never on geo', (source) => {
    for (const dimension of Object.keys(source.filters)) {
      expect(source.dimensions).toContain(dimension);
    }
    expect(source.filters).not.toHaveProperty('geo');
  });
});
