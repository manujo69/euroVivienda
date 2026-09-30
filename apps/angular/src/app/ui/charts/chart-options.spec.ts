import {
  CATEGORY_COLOURS,
  lineOption,
  pieOption,
  scatterOption,
  stackedBarsOption,
} from './chart-options';

const point = (year: number, value: number) => ({ year, value, flags: undefined });

describe('lineOption', () => {
  const option = lineOption({
    unit: '%',
    lines: [
      { name: 'España', role: 'region', points: [point(2016, 8.1), point(2018, 7.8)] },
      {
        name: 'Media UE',
        role: 'eu',
        points: [point(2015, 9), point(2016, 8.6), point(2018, 8.2)],
      },
    ],
  });
  const [region, eu] = option.series;

  it('puts every year of every line on the axis, in order', () => {
    expect(option.xAxis.data).toEqual(['2015', '2016', '2017', '2018']);
  });

  it('leaves gaps where a line has no value for a year', () => {
    expect(region?.data).toEqual([null, 8.1, null, 7.8]);
    expect(eu?.data).toEqual([9, 8.6, null, 8.2]);
  });

  it('draws the region in ink and the EU mean as a grey dashed line', () => {
    expect(region?.lineStyle).toEqual(jasmine.objectContaining({ type: 'solid' }));
    expect(eu?.lineStyle).toEqual(jasmine.objectContaining({ type: 'dashed' }));
    expect(region?.lineStyle.color).not.toBe(eu?.lineStyle.color);
  });

  it('moves the end labels apart when the lines meet', () => {
    expect(option.series.every((line) => line.labelLayout.moveOverlap === 'shiftY')).toBeTrue();
  });

  it('names each line at its end, instead of a legend', () => {
    expect(option.series.map((line) => [line.name, line.endLabel.show])).toEqual([
      ['España', true],
      ['Media UE', true],
    ]);
  });

  it('formats the values in the tooltip in Spanish, with their unit', () => {
    expect(option.tooltip.valueFormatter(7.8)).toBe('7,8 %');
    expect(option.tooltip.valueFormatter(null)).toBe('Sin dato');
  });

  it('draws only the EU mean when no region is selected', () => {
    const alone = lineOption({
      unit: '%',
      lines: [{ name: 'Media UE', role: 'eu', points: [point(2015, 9)] }],
    });
    expect(alone.series.map((line) => line.name)).toEqual(['Media UE']);
  });

  describe('with a base', () => {
    const indexed = lineOption({
      unit: '',
      base: 100,
      lines: [{ name: 'Media UE', role: 'eu', points: [point(2015, 100), point(2016, 104)] }],
    });

    it('marks the base year value with a labelled reference line', () => {
      expect(indexed.series[0]?.markLine).toEqual(
        jasmine.objectContaining({
          data: [{ yAxis: 100 }],
          label: jasmine.objectContaining({ formatter: '2015 = 100' }),
        }),
      );
    });

    it('labels the base below the line, where an index that grows leaves room', () => {
      expect(indexed.series[0]?.markLine?.label.position).toBe('insideStartBottom');
    });

    it('lets the axis start near the values instead of at zero', () => {
      expect(indexed.yAxis.scale).toBeTrue();
      expect(option.yAxis.scale).toBeFalse();
    });

    it('draws no reference line without a base', () => {
      expect(option.series.every((line) => line.markLine === undefined)).toBeTrue();
    });
  });
});

const slices = [
  { id: 'own', label: 'Propietarios', value: 75.3 },
  { id: 'rent', label: 'Inquilinos', value: 24.7 },
];

describe('pieOption', () => {
  const option = pieOption({ unit: '%', slices });
  const [pie] = option.series;

  it('draws one slice per category, in catalogue order and colour', () => {
    expect(pie?.data.map((slice) => [slice.name, slice.value])).toEqual([
      ['Propietarios', 75.3],
      ['Inquilinos', 24.7],
    ]);
    expect(option.color).toEqual(CATEGORY_COLOURS.slice(0, 2));
  });

  it('labels each slice with its share only: the card names the categories', () => {
    expect(pie?.label.formatter({ value: 75.3 })).toBe('75,3 %');
  });
});

describe('stackedBarsOption', () => {
  const categories = slices.map(({ id, label }) => ({ id, label }));
  const option = stackedBarsOption({
    categories,
    rows: [
      { name: 'España', slices },
      { name: 'Portugal', slices: [{ id: 'own', label: 'Propietarios', value: 70 }] },
    ],
    selected: 'España',
  });

  it('draws a bar per country, first on top, over the full 100 %', () => {
    expect(option.yAxis.data).toEqual(['España', 'Portugal']);
    expect(option.yAxis.inverse).toBeTrue();
    expect(option.xAxis.max).toBe(100);
  });

  it('stacks one series per category, with gaps where a country lacks one', () => {
    expect(option.series.map((series) => [series.name, series.stack, series.data])).toEqual([
      ['Propietarios', 'share', [75.3, 70]],
      ['Inquilinos', 'share', [24.7, null]],
    ]);
    // The card names the categories once, above both charts.
    expect('legend' in option).toBeFalse();
    expect(option.color).toEqual(CATEGORY_COLOURS.slice(0, 2));
  });

  it('stresses the name of the selected country', () => {
    expect(option.yAxis.axisLabel.formatter('España')).toBe('{selected|España}');
    expect(option.yAxis.axisLabel.formatter('Portugal')).toBe('Portugal');
  });
});

describe('scatterOption', () => {
  const option = scatterOption({
    x: { label: 'Edad media de emancipación', unit: 'años', year: 2023 },
    y: { label: 'Sobrecarga (Jóvenes)', unit: '%', year: 2024 },
    points: [
      { geo: 'ES', x: 30, y: 12 },
      { geo: 'ES30', x: 24, y: 10 },
    ],
    selected: 'ES30',
    names: { ES30: 'Comunidad de Madrid' },
  });
  const [series] = option.series;

  it('leaves the axes unnamed: catalogue names are too long for them, the card writes them', () => {
    expect('name' in option.xAxis).toBeFalse();
    expect('name' in option.yAxis).toBeFalse();
  });

  it('draws a point per region, named', () => {
    expect(series?.data.map((point) => [point.name, point.value])).toEqual([
      ['ES', [30, 12]],
      ['ES30', [24, 10]],
    ]);
  });

  it('stresses and labels the selected region', () => {
    const [other, selected] = series?.data ?? [];
    expect(selected?.label?.show).toBeTrue();
    expect(selected?.label?.formatter).toBe('Comunidad de Madrid');
    expect(selected?.symbolSize).toBeGreaterThan(other?.symbolSize ?? 0);
  });

  it('gives the region and both values in the tooltip, in Spanish', () => {
    expect(option.tooltip.formatter({ name: 'ES30', value: [24.5, 10] })).toBe(
      '<strong>Comunidad de Madrid</strong><br>Edad media de emancipación: 24,5 años<br>Sobrecarga (Jóvenes): 10 %',
    );
  });
});
