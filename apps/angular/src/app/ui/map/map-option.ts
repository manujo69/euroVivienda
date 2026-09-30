import { classOf } from '../../domain/indicator-rules';
import type { GeoValue } from '../../domain/indicator-rules';
import { flagLabels, geoName } from '../../domain/labels';

export type Scale = 'sequential' | 'diverging';

/**
 * ColorBrewer palettes safe for colour-blind readers: YlGnBu (sequential) and PuOr (diverging,
 * orange below 0, purple above). Keyed by number of classes.
 */
const PALETTES: Record<Scale, Record<number, readonly string[]>> = {
  sequential: {
    3: ['#edf8b1', '#7fcdbb', '#2c7fb8'],
    4: ['#ffffcc', '#a1dab4', '#41b6c4', '#225ea8'],
    5: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'],
    6: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494'],
    7: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'],
  },
  diverging: {
    3: ['#f1a340', '#f7f7f7', '#998ec3'],
    4: ['#e66101', '#fdb863', '#b2abd2', '#5e3c99'],
    5: ['#e66101', '#fdb863', '#f7f7f7', '#b2abd2', '#5e3c99'],
    6: ['#b35806', '#f1a340', '#fee0b6', '#d8daeb', '#998ec3', '#542788'],
    7: ['#b35806', '#f1a340', '#fee0b6', '#f7f7f7', '#d8daeb', '#998ec3', '#542788'],
  },
};

export function palette(scale: Scale, classes: number): readonly string[] {
  const colours = PALETTES[scale][Math.min(Math.max(classes, 3), 7)] ?? [];
  // Two classes: the ends of the three-class palette.
  return classes === 2 ? [colours[0] ?? '', colours[2] ?? ''] : colours;
}

const NUMBER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export function formatValue(value: number, unit?: string): string {
  return unit ? `${NUMBER.format(value)} ${unit}` : NUMBER.format(value);
}

/**
 * Figures of one table column with the same decimals (one, unless all are whole) and their unit,
 * so they line up on the decimal comma.
 */
export function formatColumn(values: readonly number[], unit: string): string[] {
  const decimals = values.some((value) => Math.round(value * 10) % 10 !== 0) ? 1 : 0;
  const format = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return values.map((value) => `${format.format(value)} ${unit}`);
}

export interface LegendItem {
  readonly colour: string;
  readonly label: string;
}

export function legendItems(breaks: readonly number[], scale: Scale): LegendItem[] {
  const colours = palette(scale, breaks.length + 1);
  const n = (value: number) => NUMBER.format(value);
  return colours.map((colour, i) => {
    const low = breaks[i - 1];
    const high = breaks[i];
    const label =
      low === undefined
        ? `Menos de ${n(high ?? 0)}`
        : high === undefined
          ? `${n(low)} o más`
          : `${n(low)}–${n(high)}`;
    return { colour, label };
  });
}

const INK = '#1a1a1a';
const BORDER = '#ffffff';
/** Border of light fills, where white would vanish. */
const LIGHT_BORDER = '#9e9e9e';
const NO_DATA = '#e3e3e3';
const CONTEXT = '#ececec';
/** Diagonal hatching for regions without data (spec.md: «gris con trama»). */
const HATCH = {
  color: 'rgba(0, 0, 0, 0.18)',
  dashArrayX: [1, 0],
  dashArrayY: [2, 4],
  rotation: Math.PI / 4,
};

export interface MapInput {
  /** Codes of the regions that carry data, registered in the 'nuts0' map. */
  readonly codes: readonly string[];
  /** Codes of the non-EU countries around them, registered in the same map. */
  readonly context: readonly string[];
  readonly values: readonly GeoValue[];
  readonly breaks: readonly number[];
  readonly scale: Scale;
  readonly selected: string | undefined;
  readonly unit: string;
  readonly year: number | undefined;
}

/** WCAG relative luminance of a `#rrggbb` colour, from 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or ink, whichever contrasts more with the fill (WCAG crossover at 0.179). */
function labelColour(fill: string): string {
  return luminance(fill) < 0.179 ? BORDER : INK;
}

/** White borders disappear on light fills (contrast below 1.5:1). */
function borderColour(fill: string): string {
  return luminance(fill) > 0.65 ? LIGHT_BORDER : BORDER;
}

interface ItemStyle {
  areaColor: string;
  borderColor: string;
  borderWidth: number;
  decal?: typeof HATCH;
}

interface Label {
  color: string;
  textBorderColor: string;
  textBorderWidth: number;
}

/**
 * The country code ECharts shows on hover. Codes of small countries spill over the sea and their
 * neighbours, so a halo in the opposite colour keeps them readable on any background.
 */
function hoverLabel(fill: string): Label {
  const color = labelColour(fill);
  return { color, textBorderColor: color === INK ? BORDER : INK, textBorderWidth: 2 };
}

/** One region of the ECharts map series. */
interface MapItem {
  name: string;
  value?: number;
  itemStyle: ItemStyle;
  emphasis: { itemStyle: ItemStyle; label: Label } | { disabled: true };
  tooltip?: { show: false };
}

export function mapOption(input: MapInput) {
  const colours = palette(input.scale, input.breaks.length + 1);
  const byGeo = new Map(input.values.map((entry) => [entry.geo, entry]));

  const data = input.codes.map((code): MapItem => {
    const entry = byGeo.get(code);
    const selected = code === input.selected;
    const areaColor = entry ? (colours[classOf(entry.value, input.breaks)] ?? NO_DATA) : NO_DATA;
    const itemStyle: ItemStyle = {
      areaColor,
      borderColor: selected ? INK : borderColour(areaColor),
      borderWidth: selected ? 2 : 0.6,
      ...(entry ? {} : { decal: HATCH }),
    };
    return {
      name: code,
      value: entry?.value,
      itemStyle,
      emphasis: {
        itemStyle: { ...itemStyle, borderColor: INK, borderWidth: 1.5 },
        label: hoverLabel(areaColor),
      },
    };
  });

  // Non-EU countries: grey, no tooltip, no hover (spec.md: «gris neutro y sin interacción»).
  const context = input.context.map((code): MapItem => ({
    name: code,
    itemStyle: { areaColor: CONTEXT, borderColor: BORDER, borderWidth: 0.6 },
    tooltip: { show: false },
    emphasis: { disabled: true },
  }));

  const tooltip = ({ name }: { name: string }): string => {
    const entry = byGeo.get(name);
    const title = `<strong>${geoName(name)}</strong>`;
    if (!entry) return `${title}<br>Sin dato`;
    const flags = flagLabels(entry.flags);
    const line = `${formatValue(entry.value, input.unit)} · ${input.year ?? ''}`;
    return [
      title,
      line,
      ...(flags.length ? [flags.join(', ')] : []),
      ...(entry.note ? [`<em>${entry.note}</em>`] : []),
    ].join('<br>');
  };

  return {
    animation: false,
    tooltip: {
      trigger: 'item' as const,
      formatter: tooltip,
      backgroundColor: '#ffffff',
      borderColor: INK,
      borderWidth: 1,
      textStyle: { color: INK, fontFamily: 'Source Sans 3 Variable, sans-serif', fontSize: 13 },
      // ECharts sets `white-space: nowrap` on the container; let long notes wrap.
      extraCssText: 'max-width: 280px; white-space: normal; overflow-wrap: break-word;',
      // Keep the tooltip inside the chart instead of overflowing its edges.
      confine: true,
    },
    series: [
      {
        type: 'map' as const,
        map: 'nuts0',
        nameProperty: 'code',
        // Geometries arrive projected (EPSG:3035): 1 keeps metres square.
        aspectScale: 1,
        // Fit inside the margins without stretching; otherwise they fix both width and height.
        preserveAspect: 'contain' as const,
        roam: false,
        selectedMode: false as const,
        left: 8,
        right: 8,
        top: 8,
        bottom: 8,
        label: { show: false },
        data: [...data, ...context],
      },
    ],
  };
}
