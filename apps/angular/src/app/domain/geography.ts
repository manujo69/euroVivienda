// Rules over the map geometries.

import type { Geography } from './ports';

/** NUTS code of each feature: its `code` property, or else its id. */
export const codesOf = (layer: Geography): string[] =>
  layer.features.map((feature) => String(feature.properties?.['code'] ?? feature.id));

/** Names of the named features, by code: the NUTS 2 regions carry theirs. */
export function namesOf(layer: Geography): Record<string, string> {
  return Object.fromEntries(
    layer.features.flatMap((feature) => {
      const name: unknown = feature.properties?.['name'];
      return typeof name === 'string'
        ? [[String(feature.properties?.['code'] ?? feature.id), name]]
        : [];
    }),
  );
}
