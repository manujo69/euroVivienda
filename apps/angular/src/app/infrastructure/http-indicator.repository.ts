import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Catalog, IndicatorData } from '@eurovivienda/contract';
import { firstValueFrom } from 'rxjs';
import type { IndicatorRepository } from '../domain/ports';

/** Static JSON written by `etl export`, already validated against the contract. */
@Injectable()
export class HttpIndicatorRepository implements IndicatorRepository {
  private readonly http = inject(HttpClient);

  catalog(): Promise<Catalog> {
    return firstValueFrom(this.http.get<Catalog>('catalog.json'));
  }

  data(id: string): Promise<IndicatorData> {
    return firstValueFrom(this.http.get<IndicatorData>(`data/${id}.json`));
  }
}
