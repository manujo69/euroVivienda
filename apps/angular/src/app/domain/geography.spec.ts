import type { Geography } from './ports';
import { codesOf, namesOf } from './geography';

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

describe('namesOf', () => {
  it('maps each named feature to its name', () => {
    const layer: Geography = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { code: 'ES30', name: 'Comunidad de Madrid' },
          geometry: square,
        },
        { type: 'Feature', properties: { code: 'ES' }, geometry: square },
      ],
    };
    expect(namesOf(layer)).toEqual({ ES30: 'Comunidad de Madrid' });
  });
});
