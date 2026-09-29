import type { GeoValue } from '../../domain/indicator-rules';
import { formatColumn, legendItems, mapOption, palette } from './map-option';

const values: GeoValue[] = [
  { geo: 'ES', value: 7.8, flags: undefined },
  { geo: 'PT', value: 3.1, flags: 'p' },
];

const input = {
  codes: ['ES', 'FR', 'PT'],
  context: ['CH'],
  values,
  breaks: [5, 8],
  scale: 'sequential' as const,
  selected: 'PT',
  unit: '%',
  year: 2024,
};

describe('palette', () => {
  it('gives one colour per class for each scale', () => {
    for (const classes of [2, 3, 4, 5, 6, 7]) {
      expect(palette('sequential', classes).length).toBe(classes);
      expect(palette('diverging', classes).length).toBe(classes);
    }
  });
});

describe('mapOption', () => {
  const option = mapOption(input);
  const series = option.series[0];

  it('draws the projected geometries without distorting them', () => {
    expect(series).toEqual(
      jasmine.objectContaining({ type: 'map', map: 'nuts0', aspectScale: 1, nameProperty: 'code' }),
    );
  });

  it('colours each country by class and hatches those without data', () => {
    const colours = palette('sequential', 3);
    const byName = new Map(series.data.map((item) => [item.name, item]));
    expect(byName.get('ES')?.itemStyle.areaColor).toBe(colours[1]);
    expect(byName.get('PT')?.itemStyle.areaColor).toBe(colours[0]);
    expect(byName.get('FR')?.itemStyle.decal).toBeDefined();
    expect(byName.get('ES')?.itemStyle.decal).toBeUndefined();
  });

  it('greys out the non-EU countries and keeps them silent', () => {
    const context = series.data.find((item) => item.name === 'CH');
    expect(context?.itemStyle.areaColor).toBe('#ececec');
    expect(context?.itemStyle.decal).toBeUndefined();
    expect(context?.tooltip).toEqual({ show: false });
    expect(context?.emphasis).toEqual({ disabled: true });
  });

  it('outlines the selected country', () => {
    const byName = new Map(series.data.map((item) => [item.name, item]));
    expect(byName.get('PT')?.itemStyle.borderWidth).toBeGreaterThan(
      byName.get('ES')?.itemStyle.borderWidth ?? 0,
    );
  });

  it('explains value, year and flags in the tooltip', () => {
    expect(option.tooltip.formatter({ name: 'PT' })).toBe(
      '<strong>Portugal</strong><br>3,1 % · 2024<br>provisional',
    );
    expect(option.tooltip.formatter({ name: 'FR' })).toBe('<strong>Francia</strong><br>Sin dato');
  });

  it('adds the note of the value to the tooltip', () => {
    const noted = mapOption({
      ...input,
      values: [{ geo: 'ES', value: 7.8, flags: undefined, note: 'Muestra pequeña.' }],
    });
    expect(noted.tooltip.formatter({ name: 'ES' })).toBe(
      '<strong>España</strong><br>7,8 % · 2024<br><em>Muestra pequeña.</em>',
    );
  });
});

describe('formatColumn', () => {
  it('gives every figure of a column the same decimals and its unit', () => {
    expect(formatColumn([56, 39.5, 7.25], '%')).toEqual(['56,0 %', '39,5 %', '7,3 %']);
  });

  it('keeps whole numbers whole', () => {
    expect(formatColumn([31500, 9600], 'PPS')).toEqual(['31.500 PPS', '9600 PPS']);
  });
});

describe('legendItems', () => {
  it('labels each class with its range, formatted in Spanish', () => {
    expect(legendItems([5.2, 7.15], 'sequential').map((item) => item.label)).toEqual([
      'Menos de 5,2',
      '5,2–7,2',
      '7,2 o más',
    ]);
  });
});
