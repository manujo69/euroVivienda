import { lineOption } from './chart-options';

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
});
