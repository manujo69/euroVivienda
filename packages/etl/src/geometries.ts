// GISCO geometries behind the map, verified in task 0.3.

/** Chosen in the coverage report (task 0.6): it fits the latest years of every regional series. */
export const NUTS_VERSION = '2024';

const GISCO = 'https://gisco-services.ec.europa.eu/distribution/v2';

// 20M scale, already projected to EPSG:3035: the ETL never reprojects.
export function nutsUrl(level: 0 | 2): string {
  return `${GISCO}/nuts/geojson/NUTS_RG_20M_${NUTS_VERSION}_3035_LEVL_${level}.geojson`;
}

/** Every country in the world; the map uses it for the grey non-EU context. */
export function countriesUrl(): string {
  return `${GISCO}/countries/geojson/CNTR_RG_20M_2024_3035.geojson`;
}

export const GEOMETRY_ATTRIBUTION = '© EuroGeographics para los límites administrativos';
