// UrlStatePort over the Angular router.

import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { UrlStatePort } from '../domain/ports';
import type { QueryParams } from '../domain/url-state';

@Injectable()
export class RouterUrlStateAdapter implements UrlStatePort {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** From the browser URL itself: the first navigation may not have finished yet. */
  read(): Promise<QueryParams> {
    const params = this.router.parseUrl(this.location.path()).queryParams;
    return Promise.resolve(
      Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    );
  }

  async write(params: QueryParams): Promise<void> {
    await this.router.navigate([], { queryParams: params, replaceUrl: true });
  }
}
