import { flagLabels, geoName, themeName } from './labels';

describe('geoName', () => {
  it('names the EU countries and the aggregate in Spanish', () => {
    expect(geoName('DE')).toBe('Alemania');
    expect(geoName('EL')).toBe('Grecia');
    expect(geoName('EU27_2020')).toBe('Media UE');
  });

  it('falls back to the code for anything else', () => {
    expect(geoName('ES30')).toBe('ES30');
  });
});

describe('flagLabels', () => {
  it('spells out each Eurostat flag letter', () => {
    expect(flagLabels('bp')).toEqual(['ruptura de serie', 'provisional']);
    expect(flagLabels(undefined)).toEqual([]);
  });
});

describe('themeName', () => {
  it('names each theme of the catalogue in Spanish', () => {
    expect(themeName('prices')).toBe('Precios');
    expect(themeName('access')).toBe('Acceso');
    expect(themeName('context')).toBe('Contexto');
  });
});
