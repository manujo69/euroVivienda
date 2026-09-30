import type { Geography } from './ports';
import { codesOf } from './geography';

const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};

describe('codesOf', () => {
  it('gives the NUTS code of each feature, from its properties or else its id', () => {
    const layer: Geography = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { code: 'ES' }, geometry: square },
        { type: 'Feature', id: 'PT', properties: {}, geometry: square },
      ],
    };
    expect(codesOf(layer)).toEqual(['ES', 'PT']);
  });
});
