import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Geography, GeographyRepository, MapGeography } from '../domain/ports';

/** TopoJSON written by `etl export`; the rest of the app only sees GeoJSON. */
@Injectable()
export class HttpGeographyRepository implements GeographyRepository {
  private readonly http = inject(HttpClient);

  nuts0(): Promise<MapGeography> {
    return this.level('nuts0');
  }

  nuts2(): Promise<MapGeography> {
    return this.level('nuts2');
  }

  private async level(name: 'nuts0' | 'nuts2'): Promise<MapGeography> {
    const topology = await firstValueFrom(this.http.get<Topology>(`geo/${name}.json`));
    return { regions: layer(topology, name), context: layer(topology, 'context') };
  }
}

function layer(topology: Topology, name: string): Geography {
  const object = topology.objects[name];
  if (object?.type !== 'GeometryCollection') {
    throw new Error(`the topology has no ${name} geometry collection`);
  }
  return feature(topology, object) as Geography;
}
