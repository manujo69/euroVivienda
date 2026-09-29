// Ports: what the application needs from the outside world. Plain TypeScript, no Angular.

import type { Catalog, IndicatorData } from '@eurovivienda/contract';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

/** Countries or regions, projected to EPSG:3035, each feature's id being its NUTS code. */
export type Geography = FeatureCollection<Polygon | MultiPolygon>;

export interface IndicatorRepository {
  catalog(): Promise<Catalog>;
  data(id: string): Promise<IndicatorData>;
}

/** The map: the regions that carry data and the non-EU countries drawn around them in grey. */
export interface MapGeography {
  readonly regions: Geography;
  readonly context: Geography;
}

export interface GeographyRepository {
  /** EU-27 countries, outermost regions left out, with their non-EU context. */
  nuts0(): Promise<MapGeography>;
}
