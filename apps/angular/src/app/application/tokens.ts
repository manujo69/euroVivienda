// Injection tokens for the domain ports; app.config.ts binds each one to its adapter.

import { InjectionToken } from '@angular/core';
import type { GeographyRepository, IndicatorRepository, UrlStatePort } from '../domain/ports';

export const INDICATOR_REPOSITORY = new InjectionToken<IndicatorRepository>('IndicatorRepository');
export const GEOGRAPHY_REPOSITORY = new InjectionToken<GeographyRepository>('GeographyRepository');
export const URL_STATE = new InjectionToken<UrlStatePort>('UrlStatePort');
