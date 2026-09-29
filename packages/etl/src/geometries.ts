// GISCO geometries behind the map, verified in task 0.3.

/** Both candidate NUTS versions until the coverage report settles the choice. */
export const NUTS_VERSIONS = ['2021', '2024'] as const;
export type NutsVersion = (typeof NUTS_VERSIONS)[number];

const GISCO = 'https://gisco-services.ec.europa.eu/distribution/v2';

// 20M scale, already projected to EPSG:3035: the ETL never reprojects.
export function nutsUrl(level: 0 | 2, version: NutsVersion): string {
  return `${GISCO}/nuts/geojson/NUTS_RG_20M_${version}_3035_LEVL_${level}.geojson`;
}

/** Every country in the world; the map uses it for the grey non-EU context. */
export function countriesUrl(): string {
  return `${GISCO}/countries/geojson/CNTR_RG_20M_2024_3035.geojson`;
}

/**
 * Outermost regions (art. 349 TFEU), identical in NUTS 2021 and 2024. Saint-Martin has no NUTS
 * code. They stay off the map; their NUTS 0 countries include them and must be clipped too.
 */
export const OUTERMOST_REGIONS: readonly string[] = [
  'ES70', // Canarias
  'FRY1', // Guadeloupe
  'FRY2', // Martinique
  'FRY3', // Guyane
  'FRY4', // La Réunion
  'FRY5', // Mayotte
  'PT20', // Região Autónoma dos Açores
  'PT30', // Região Autónoma da Madeira
];

export const GEOMETRY_ATTRIBUTION = '© EuroGeographics para los límites administrativos';
