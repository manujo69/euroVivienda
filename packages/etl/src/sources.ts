// Eurostat datasets behind the indicator catalogue (spec.md), verified in task 0.2.

export interface Source {
  /** Eurostat dataset code, also the name of its staging table. */
  readonly code: string;
  readonly title: string;
  /** Dimensions in the order of the Eurostat data structure, time excluded. */
  readonly dimensions: readonly string[];
  /** Codes to keep per dimension; a dimension left out keeps every code. */
  readonly filters: Readonly<Record<string, readonly string[]>>;
}

export const START_PERIOD = 2015;

const SDMX_DATA = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data';
const DATA_BROWSER = 'https://ec.europa.eu/eurostat/databrowser/view';

export const sources: readonly Source[] = [
  {
    code: 'prc_hpi_a',
    title: 'House price index - annual data',
    dimensions: ['freq', 'purchase', 'unit', 'geo'],
    // Current base (2025 = 100); the ETL rebases to 2015.
    filters: { freq: ['A'], purchase: ['TOTAL', 'DW_NEW', 'DW_EXST'], unit: ['I25_A_AVG'] },
  },
  {
    // Replaces prc_hicp_aind, discontinued in 2026 (ECOICOP ver. 2, base 2025 = 100).
    code: 'prc_hicp_ainr',
    title: 'HICP - ECOICOP ver. 2 - indices and rates of change, annual data',
    dimensions: ['freq', 'unit', 'coicop18', 'geo'],
    // CP0411: rents paid by tenants for their main residence.
    filters: { freq: ['A'], unit: ['INX_A_AVG'], coicop18: ['CP0411'] },
  },
  {
    code: 'nama_10r_2hhinc',
    title: 'Income of households by NUTS 2 region',
    dimensions: ['freq', 'unit', 'direct', 'na_item', 'geo'],
    // PPS per inhabitant for the map. Price vs income needs national currency per inhabitant,
    // which Eurostat does not publish: MIO_NAC * EUR_HAB / MIO_EUR.
    filters: {
      freq: ['A'],
      unit: ['PPS_EU27_2020_HAB', 'EUR_HAB', 'MIO_NAC', 'MIO_EUR'],
      direct: ['BAL'],
      na_item: ['B6N'],
    },
  },
  {
    code: 'ilc_lvho07a',
    title: 'Housing cost overburden rate by age, sex and poverty status',
    dimensions: ['freq', 'unit', 'rskpovth', 'age', 'sex', 'geo'],
    filters: {
      freq: ['A'],
      unit: ['PC'],
      rskpovth: ['TOTAL'],
      age: ['TOTAL', 'Y20-29'],
      sex: ['T'],
    },
  },
  {
    code: 'ilc_lvho07c',
    title: 'Housing cost overburden rate by tenure status',
    dimensions: ['freq', 'unit', 'tenure', 'geo'],
    filters: { freq: ['A'], unit: ['PC'] },
  },
  {
    code: 'ilc_lvho02',
    title: 'Distribution of population by tenure status, type of household and income group',
    dimensions: ['freq', 'rskpovth', 'hhcomp', 'tenure', 'unit', 'geo'],
    filters: { freq: ['A'], rskpovth: ['TOTAL'], hhcomp: ['TOTAL'], unit: ['PC'] },
  },
  {
    code: 'yth_demo_030',
    title: 'Estimated average age of young persons leaving the parental household',
    dimensions: ['freq', 'unit', 'sex', 'geo'],
    filters: { freq: ['A'], unit: ['AVG'] },
  },
  {
    code: 'lfst_r_lfu3rt',
    title: 'Unemployment rates by educational attainment level and NUTS 2 region',
    dimensions: ['freq', 'isced11', 'sex', 'age', 'unit', 'geo'],
    filters: { freq: ['A'], isced11: ['TOTAL'], sex: ['T'], age: ['Y15-74'], unit: ['PC'] },
  },
  {
    code: 'tour_occ_nin2',
    title: 'Nights spent at tourist accommodation establishments by NUTS 3 region',
    dimensions: ['freq', 'c_resid', 'unit', 'nace_r2', 'geo'],
    // Eurostat's own nights per thousand inhabitants, EU27_2020 included.
    filters: { freq: ['A'], c_resid: ['TOTAL'], unit: ['P_THAB'], nace_r2: ['I551-I553'] },
  },
  {
    // Accepted by the coverage report (task 0.6). No EU27_2020 aggregate.
    code: 'demo_r_gind3',
    title: 'Population change - demographic balance and crude rates at regional level (NUTS 3)',
    dimensions: ['freq', 'indic_de', 'geo'],
    filters: { freq: ['A'], indic_de: ['GROWRT', 'CNMIGRATRT'] },
  },
];

export function downloadUrl(source: Source): string {
  const key = source.dimensions.map((dimension) => source.filters[dimension]?.join('+') ?? '');
  return (
    `${SDMX_DATA}/${source.code}/${key.join('.')}` +
    `?format=SDMX-CSV&compressed=true&startPeriod=${START_PERIOD}`
  );
}

export function pageUrl(source: Source): string {
  return `${DATA_BROWSER}/${source.code}/default/table`;
}

export function attribution(source: Source): string {
  return `Fuente: Eurostat (${source.code})`;
}
