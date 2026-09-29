// Spanish names and meanings shown to the user.

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

/** Spanish name of an EU country or the EU aggregate; regions keep their code for now. */
export function geoName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
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
