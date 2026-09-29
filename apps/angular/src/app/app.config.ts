import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { GEOGRAPHY_REPOSITORY, INDICATOR_REPOSITORY } from './application/tokens';
import { HttpGeographyRepository } from './infrastructure/http-geography.repository';
import { HttpIndicatorRepository } from './infrastructure/http-indicator.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    // Ports of the domain, each bound to its adapter.
    { provide: INDICATOR_REPOSITORY, useClass: HttpIndicatorRepository },
    { provide: GEOGRAPHY_REPOSITORY, useClass: HttpGeographyRepository },
  ],
};
