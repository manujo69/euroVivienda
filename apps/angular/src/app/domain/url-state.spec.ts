import type { IndicatorMeta } from '@eurovivienda/contract';
import { normalizeUrlState, parseUrlState, serializeUrlState, type UrlState } from './url-state';

const meta = (id: string, extra: Partial<IndicatorMeta> = {}): IndicatorMeta => ({
  id,
  label: id,
  theme: 'access',
  kind: 'scalar',
  unit: '%',
  levels: [0],
  years: [2015, 2025],
  source: { name: 'Eurostat', code: id, url: 'https://example.test', lastUpdate: '2026-09-17' },
  breakdowns: [{ id: 'total', label: 'Total' }],
  scale: 'sequential',
  breaks: { total: [10, 20] },
  ...extra,
});

const overburden = meta('overburden', {
  breakdowns: [
    { id: 'rent_mkt', label: 'Inquilinos a precio de mercado' },
    { id: 'youth', label: 'Jóvenes' },
  ],
  breaks: { rent_mkt: [10, 20], youth: [10, 20] },
});
const catalog = [overburden, meta('tenure'), meta('income', { years: [2015, 2023] })];
const geos = ['ES', 'PT'];

const state = (extra: Partial<UrlState> = {}): UrlState => ({
  ind: ['overburden'],
  main: 'overburden',
  geo: undefined,
  year: 2025,
  level: 0,
  bd: {},
  ...extra,
});

describe('parseUrlState', () => {
  it('reads the query parameters of spec.md', () => {
    expect(
      parseUrlState({
        ind: 'income,overburden',
        main: 'income',
        geo: 'ES',
        year: '2023',
        level: '0',
        bd: 'overburden:youth',
      }),
    ).toEqual({
      ind: ['income', 'overburden'],
      main: 'income',
      geo: 'ES',
      year: 2023,
      level: 0,
      bd: { overburden: 'youth' },
    });
  });

  it('leaves out what is missing or unreadable', () => {
    expect(parseUrlState({ year: 'abc', level: '7', bd: 'broken' })).toEqual({
      ind: [],
      main: undefined,
      geo: undefined,
      year: undefined,
      level: 7,
      bd: {},
    });
  });
});

describe('serializeUrlState', () => {
  it('writes the parameters in a fixed order, the selection only when there is one', () => {
    expect(
      serializeUrlState(
        state({ ind: ['tenure', 'overburden'], geo: 'ES', bd: { overburden: 'youth' } }),
      ),
    ).toEqual({
      ind: 'tenure,overburden',
      main: 'overburden',
      geo: 'ES',
      year: '2025',
      level: '0',
      bd: 'overburden:youth',
    });
    expect(serializeUrlState(state())).toEqual({
      ind: 'overburden',
      main: 'overburden',
      year: '2025',
      level: '0',
    });
  });

  it('reads back what it writes', () => {
    const written = state({
      ind: ['tenure', 'overburden'],
      geo: 'PT',
      bd: { overburden: 'youth' },
    });
    expect(parseUrlState(serializeUrlState(written))).toEqual(written);
  });
});

describe('normalizeUrlState', () => {
  const normalize = (extra: Partial<UrlState>) => normalizeUrlState(state(extra), catalog, geos);

  it('keeps a valid state as it is', () => {
    const valid = state({
      ind: ['tenure', 'overburden'],
      geo: 'ES',
      year: 2020,
      bd: { overburden: 'youth' },
    });
    expect(normalizeUrlState(valid, catalog, geos)).toEqual(valid);
  });

  it('drops unknown and repeated indicators, and falls back to the first of the catalogue', () => {
    expect(normalize({ ind: ['hpi', 'tenure', 'tenure'], main: 'tenure' }).ind).toEqual(['tenure']);
    expect(normalize({ ind: ['hpi'], main: undefined })).toEqual(
      jasmine.objectContaining({ ind: ['overburden'], main: 'overburden' }),
    );
  });

  it('puts on the map the last active indicator when main is not active', () => {
    expect(normalize({ ind: ['overburden', 'tenure'], main: 'income' }).main).toBe('tenure');
    expect(normalize({ ind: ['overburden', 'tenure'], main: undefined }).main).toBe('tenure');
  });

  it('forgets a region outside the map', () => {
    expect(normalize({ geo: 'XX' }).geo).toBeUndefined();
  });

  it('brings the year into the range of the active indicators, or to the latest one', () => {
    expect(normalize({ ind: ['income'], main: 'income', year: 2025 }).year).toBe(2023);
    expect(normalize({ year: 1990 }).year).toBe(2015);
    expect(normalize({ year: undefined }).year).toBe(2025);
  });

  it('keeps only breakdowns declared by an active indicator, other than its first', () => {
    expect(
      normalize({ bd: { overburden: 'unknown', tenure: 'total', income: 'total' } }).bd,
    ).toEqual({});
    expect(normalize({ bd: { overburden: 'rent_mkt' } }).bd).toEqual({});
  });

  it('keeps NUTS 0 or NUTS 2, and falls back to countries for any other level', () => {
    expect(normalize({ level: 2 }).level).toBe(2);
    expect(normalize({ level: 3 }).level).toBe(0);
  });
});
