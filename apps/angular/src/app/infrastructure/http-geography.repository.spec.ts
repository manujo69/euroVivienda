import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpGeographyRepository } from './http-geography.repository';

// Two squares sharing an edge, as mapshaper writes them: quantised, delta-encoded arcs.
const topology = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [3000000, 2000000] },
  arcs: [
    [
      [1, 0],
      [0, 1],
    ],
    [
      [1, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ],
    [
      [1, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ],
    [
      [0, 1],
      [0, 1],
      [1, 0],
      [0, -1],
    ],
  ],
  objects: {
    nuts0: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: 'ES', arcs: [[0, 1]] },
        { type: 'Polygon', id: 'PT', arcs: [[~0, 2]] },
      ],
    },
    context: {
      type: 'GeometryCollection',
      geometries: [{ type: 'Polygon', id: 'AD', arcs: [[3]] }],
    },
  },
};

describe('HttpGeographyRepository', () => {
  it('turns the EU countries and their non-EU context into GeoJSON keyed by code', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpGeographyRepository],
    });
    const repository = TestBed.inject(HttpGeographyRepository);
    const http = TestBed.inject(HttpTestingController);

    const loading = repository.nuts0();
    http.expectOne('geo/nuts0.json').flush(topology);
    const { regions, context } = await loading;

    expect(regions.type).toBe('FeatureCollection');
    expect(regions.features.map((feature) => feature.id)).toEqual(['ES', 'PT']);
    expect(regions.features[0]?.geometry.type).toBe('Polygon');
    expect(context.features.map((feature) => feature.id)).toEqual(['AD']);
    http.verify();
  });
});
