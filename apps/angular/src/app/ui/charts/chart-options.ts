// ECharts options for the panel cards, built from the state as pure functions.

import type { Point } from '../../domain/indicator-rules';
import { formatValue } from '../map/map-option';

/** Dark end of the map palette for the region; muted ink for the EU mean. */
const REGION = '#225ea8';
const EU = '#5f5f5f';

export interface Line {
  readonly name: string;
  readonly role: 'region' | 'eu';
  readonly points: readonly Point[];
}

export interface LineInput {
  readonly unit: string;
  readonly lines: readonly Line[];
  /** Value of the base year of an index (2015 = 100), drawn as a reference line. */
  readonly base?: number;
}

function baseLine(base: number) {
  return {
    silent: true,
    symbol: 'none',
    data: [{ yAxis: base }],
    lineStyle: { color: '#1a1a1a', width: 1, type: 'solid' as const },
    label: { position: 'insideStartTop' as const, formatter: `2015 = ${base}`, color: '#5f5f5f' },
  };
}

export function lineOption(input: LineInput) {
  const years = [...new Set(input.lines.flatMap((line) => line.points.map((p) => p.year)))].sort(
    (a, b) => a - b,
  );
  const axis: number[] = [];
  for (let year = years[0] ?? 0; year <= (years.at(-1) ?? -1); year++) axis.push(year);

  const series = input.lines.map((line, i) => {
    const byYear = new Map(line.points.map((p) => [p.year, p.value]));
    const colour = line.role === 'region' ? REGION : EU;
    return {
      type: 'line' as const,
      name: line.name,
      data: axis.map((year) => byYear.get(year) ?? null),
      symbol: 'circle',
      symbolSize: 4,
      itemStyle: { color: colour },
      lineStyle: {
        color: colour,
        width: line.role === 'region' ? 2 : 1.5,
        type: line.role === 'region' ? ('solid' as const) : ('dashed' as const),
      },
      // Direct labels instead of a legend.
      endLabel: { show: true, formatter: line.name, color: colour },
      markLine: i === 0 && input.base !== undefined ? baseLine(input.base) : undefined,
    };
  });

  return {
    animation: false,
    grid: { left: 8, right: 72, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: axis.map(String),
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      // An index moves around its base: zero would squash the lines.
      scale: input.base !== undefined,
      axisLabel: { formatter: (value: number) => formatValue(value) },
      splitLine: { lineStyle: { color: '#ececec' } },
    },
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (value: number | null) =>
        typeof value === 'number' ? formatValue(value, input.unit) : 'Sin dato',
    },
    series,
  };
}
