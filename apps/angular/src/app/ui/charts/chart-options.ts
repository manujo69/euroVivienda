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
}

export function lineOption(input: LineInput) {
  const years = [...new Set(input.lines.flatMap((line) => line.points.map((p) => p.year)))].sort(
    (a, b) => a - b,
  );
  const axis: number[] = [];
  for (let year = years[0] ?? 0; year <= (years.at(-1) ?? -1); year++) axis.push(year);

  const series = input.lines.map((line) => {
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
