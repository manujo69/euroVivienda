// Rules over the map geometries.

import type { Geography } from './ports';

/** NUTS code of each feature: its `code` property, or else its id. */
export const codesOf = (layer: Geography): string[] =>
  layer.features.map((feature) => String(feature.properties?.['code'] ?? feature.id));
