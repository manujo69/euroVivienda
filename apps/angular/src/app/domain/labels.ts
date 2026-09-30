// Spanish names and meanings shown to the user.

import type { Theme } from './indicator-rules';

const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  AT: 'Austria',
  BE: 'Bélgica',
  BG: 'Bulgaria',
  CY: 'Chipre',
  CZ: 'Chequia',
  DE: 'Alemania',
  DK: 'Dinamarca',
  EE: 'Estonia',
  EL: 'Grecia',
  ES: 'España',
  FI: 'Finlandia',
  FR: 'Francia',
  HR: 'Croacia',
  HU: 'Hungría',
  IE: 'Irlanda',
  IT: 'Italia',
  LT: 'Lituania',
  LU: 'Luxemburgo',
  LV: 'Letonia',
  MT: 'Malta',
  NL: 'Países Bajos',
  PL: 'Polonia',
  PT: 'Portugal',
  RO: 'Rumanía',
  SE: 'Suecia',
  SI: 'Eslovenia',
  SK: 'Eslovaquia',
  EU27_2020: 'Media UE',
};

/** Spanish name of an EU country or the EU aggregate; regions take theirs from the map, if given. */
export function geoName(code: string, regions: Readonly<Record<string, string>> = {}): string {
  return COUNTRY_NAMES[code] ?? regions[code] ?? code;
}

/** Eurostat flags (spec.md, «Mapa»). */
const FLAGS: Readonly<Record<string, string>> = {
  b: 'ruptura de serie',
  c: 'confidencial',
  d: 'definición distinta',
  e: 'estimado',
  n: 'no significativo',
  p: 'provisional',
  u: 'baja fiabilidad',
};

export function flagLabels(flags: string | undefined): string[] {
  return [...(flags ?? '')].map((flag) => FLAGS[flag] ?? flag);
}

const THEME_NAMES: Readonly<Record<Theme, string>> = {
  prices: 'Precios',
  access: 'Acceso',
  context: 'Contexto',
};

export function themeName(theme: Theme): string {
  return THEME_NAMES[theme];
}
