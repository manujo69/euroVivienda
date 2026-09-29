import { describe, expect, it } from 'vitest';
import { GEOMETRY_ATTRIBUTION, countriesUrl, nutsUrl } from '../src/geometries.ts';

const GISCO = 'https://gisco-services.ec.europa.eu/distribution/v2';

describe('nutsUrl', () => {
  it('points to the 20M GeoJSON already projected to EPSG:3035', () => {
    expect(nutsUrl(0)).toBe(`${GISCO}/nuts/geojson/NUTS_RG_20M_2024_3035_LEVL_0.geojson`);
    expect(nutsUrl(2)).toBe(`${GISCO}/nuts/geojson/NUTS_RG_20M_2024_3035_LEVL_2.geojson`);
  });
});

describe('countriesUrl', () => {
  it('points to the 20M EPSG:3035 country layer', () => {
    expect(countriesUrl()).toBe(`${GISCO}/countries/geojson/CNTR_RG_20M_2024_3035.geojson`);
  });
});

describe('GEOMETRY_ATTRIBUTION', () => {
  it('credits EuroGeographics for the boundaries', () => {
    expect(GEOMETRY_ATTRIBUTION).toContain('EuroGeographics');
  });
});
