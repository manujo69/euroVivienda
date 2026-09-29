import { describe, expect, it } from 'vitest';
import {
  GEOMETRY_ATTRIBUTION,
  OUTERMOST_REGIONS,
  countriesUrl,
  nutsUrl,
} from '../src/geometries.ts';

const GISCO = 'https://gisco-services.ec.europa.eu/distribution/v2';

describe('nutsUrl', () => {
  it('points to the 20M GeoJSON already projected to EPSG:3035', () => {
    expect(nutsUrl(0, '2024')).toBe(`${GISCO}/nuts/geojson/NUTS_RG_20M_2024_3035_LEVL_0.geojson`);
    expect(nutsUrl(2, '2021')).toBe(`${GISCO}/nuts/geojson/NUTS_RG_20M_2021_3035_LEVL_2.geojson`);
  });
});

describe('countriesUrl', () => {
  it('points to the 20M EPSG:3035 country layer', () => {
    expect(countriesUrl()).toBe(`${GISCO}/countries/geojson/CNTR_RG_20M_2024_3035.geojson`);
  });
});

describe('OUTERMOST_REGIONS', () => {
  it('lists the NUTS 2 codes of the outermost regions once each', () => {
    expect(OUTERMOST_REGIONS).toHaveLength(new Set(OUTERMOST_REGIONS).size);
    for (const code of OUTERMOST_REGIONS) {
      expect(code).toMatch(/^[A-Z]{2}[0-9A-Z]{2}$/);
    }
  });
});

describe('GEOMETRY_ATTRIBUTION', () => {
  it('credits EuroGeographics for the boundaries', () => {
    expect(GEOMETRY_ATTRIBUTION).toContain('EuroGeographics');
  });
});
