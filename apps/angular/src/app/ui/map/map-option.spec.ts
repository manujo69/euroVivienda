import type { GeoValue } from '../../domain/indicator-rules';
import {
  displayUnit,
  formatColumn,
  formatValue,
  legendItems,
  mapOption,
  palette,
} from './map-option';

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
      jasmine.objectContaining({
        type: 'map',
        map: 'nuts0',
        aspectScale: 1,
        // Without it, the four margins stretch the map to the shape of its container.
        preserveAspect: 'contain',
        nameProperty: 'code',
      }),
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

  it('adapts label and border colours to the lightness of the fill', () => {
    const colours = palette('sequential', 7);
    const shaded = mapOption({
      ...input,
      breaks: [1, 2, 3, 4, 5, 6],
      selected: undefined,
      values: [
        { geo: 'ES', value: 100, flags: undefined },
        { geo: 'PT', value: 0, flags: undefined },
      ],
    });
    const byName = new Map(shaded.series[0].data.map((item) => [item.name, item]));
    const dark = byName.get('ES');
    const light = byName.get('PT');
    expect(dark?.itemStyle.areaColor).toBe(colours[6]);
    expect(light?.itemStyle.areaColor).toBe(colours[0]);
    // A halo in the opposite colour keeps codes of small countries readable off their polygon.
    expect(dark?.emphasis).toEqual(
      jasmine.objectContaining({
        label: { color: '#ffffff', textBorderColor: '#1a1a1a', textBorderWidth: 2 },
      }),
    );
    expect(light?.emphasis).toEqual(
      jasmine.objectContaining({
        label: { color: '#1a1a1a', textBorderColor: '#ffffff', textBorderWidth: 2 },
      }),
    );
    expect(dark?.itemStyle.borderColor).toBe('#ffffff');
    expect(light?.itemStyle.borderColor).toBe('#9e9e9e');
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

describe('mapOption at NUTS 2', () => {
  const regional = {
    ...input,
    map: 'nuts2',
    codes: ['ES30', 'ES51'],
    context: [],
    values: [
      { geo: 'ES30', value: 7.8, flags: undefined },
      { geo: 'ES51', value: 3.1, flags: undefined },
    ],
    selected: undefined,
    names: { ES30: 'Comunidad de Madrid', ES51: 'Cataluña' },
  };
  const option = mapOption(regional);

  it('draws on the map it is given, the countries by default', () => {
    expect(option.series[0].map).toBe('nuts2');
    expect(mapOption(input).series[0].map).toBe('nuts0');
  });

  it('names the region in the tooltip', () => {
    expect(option.tooltip.formatter({ name: 'ES30' })).toBe(
      '<strong>Comunidad de Madrid</strong><br>7,8 % · 2024',
    );
    expect(option.tooltip.formatter({ name: 'ES51' })).toBe(
      '<strong>Cataluña</strong><br>3,1 % · 2024',
    );
  });
});

describe('signed figures of an index', () => {
  it('sign the change since 2015', () => {
    expect(formatValue(8.2, '%', true)).toBe('+8,2 %');
    expect(formatValue(-3.1, '%', true)).toBe('-3,1 %');
    expect(formatColumn([8.2, -3], '%', true)).toEqual(['+8,2 %', '-3,0 %']);
  });

  it('show an index as a percentage change, and anything else in its own unit', () => {
    expect(displayUnit({ kind: 'index', unit: 'Índice (2015 = 100)' })).toBe('%');
    expect(displayUnit({ kind: 'derived', unit: 'Índice (2015 = 100)' })).toBe(
      'Índice (2015 = 100)',
    );
  });

  it('explain the change in the map tooltip', () => {
    const option = mapOption({ ...input, unit: '%', signed: true });
    expect(option.tooltip.formatter({ name: 'ES' })).toBe(
      '<strong>España</strong><br>+7,8 % desde 2015 · 2024',
    );
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
