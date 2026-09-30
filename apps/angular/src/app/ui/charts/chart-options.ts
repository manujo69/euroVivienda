// ECharts options for the panel cards, built from the state as pure functions.

import type { Point, Slice } from '../../domain/indicator-rules';
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

/**
 * Okabe–Ito colours, safe for colour-blind readers, one per category in catalogue order. In tenure
 * the owners come first (blues) and the tenants after (oranges).
 */
export const CATEGORY_COLOURS: readonly string[] = [
  '#0072b2',
  '#56b4e9',
  '#e69f00',
  '#d55e00',
  '#009e73',
  '#cc79a7',
];

export interface PieInput {
  readonly unit: string;
  readonly slices: readonly Slice[];
}

export function pieOption(input: PieInput) {
  return {
    animation: false,
    color: CATEGORY_COLOURS.slice(0, input.slices.length),
    tooltip: {
      trigger: 'item' as const,
      valueFormatter: (value: number) => formatValue(value, input.unit),
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['0%', '62%'],
        data: input.slices.map((slice) => ({ name: slice.label, value: slice.value })),
        label: {
          formatter: ({ name, value }: { name: string; value: number }) =>
            `${name}\n${formatValue(value, input.unit)}`,
          fontSize: 11,
        },
      },
    ],
  };
}

export interface BarsInput {
  readonly categories: readonly { id: string; label: string }[];
  /** One bar per region, in the order they are drawn from the top. */
  readonly rows: readonly { name: string; slices: readonly Slice[] }[];
  /** Name of the selected region, stressed on the axis. */
  readonly selected: string | undefined;
}

/** Bars stacked to 100 % to compare the composition across regions. */
export function stackedBarsOption(input: BarsInput) {
  return {
    animation: false,
    color: CATEGORY_COLOURS.slice(0, input.categories.length),
    legend: { data: input.categories.map((category) => category.label), top: 0, left: 0 },
    grid: { left: 8, right: 16, top: 56, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (value: number | null) =>
        typeof value === 'number' ? formatValue(value, '%') : 'Sin dato',
    },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value} %' } },
    yAxis: {
      type: 'category' as const,
      data: input.rows.map((row) => row.name),
      inverse: true,
      axisTick: { show: false },
      axisLabel: {
        formatter: (name: string) => (name === input.selected ? `{selected|${name}}` : name),
        rich: { selected: { fontWeight: 'bold' as const } },
      },
    },
    series: input.categories.map((category) => ({
      type: 'bar' as const,
      name: category.label,
      stack: 'share',
      barWidth: '70%',
      data: input.rows.map(
        (row) => row.slices.find((slice) => slice.id === category.id)?.value ?? null,
      ),
    })),
  };
}
