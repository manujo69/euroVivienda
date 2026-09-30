import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Card } from '../../../application/explorer.store';
import { EU_AGGREGATE, slicesOf, timeSeries } from '../../../domain/indicator-rules';
import { flagLabels, geoName } from '../../../domain/labels';
import { formatValue } from '../../map/map-option';
import {
  CATEGORY_COLOURS,
  type Line,
  lineOption,
  pieOption,
  stackedBarsOption,
} from '../chart-options';
import { ChartComponent } from '../chart-component/chart.component';
import { RankingComponent } from '../ranking-component/ranking.component';

const SIGNED = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/** One active indicator in the panel: its headline figure, and its charts when open. */
@Component({
  selector: 'app-card',
  imports: [ChartComponent, RankingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  readonly card = input.required<Card>();
  readonly opened = output<void>();
  /** A country picked in the ranking or the bars, to select it everywhere. */
  readonly regionPicked = output<string>();

  protected readonly figure = computed(() => {
    const { meta, headline, year } = this.card();
    if (!headline) return undefined;
    // An index leads with its change since 2015, as the map paints it.
    const index = meta.kind === 'index';
    return {
      value: index ? SIGNED.format(headline.value) : formatValue(headline.value),
      unit: index ? '%' : meta.unit,
      flags: headline.flags ?? '',
      flagText: flagLabels(headline.flags).join(', '),
      explanation:
        `${geoName(headline.geo)} en ${year}` +
        (index ? ', desde 2015' : '') +
        (meta.mapCategory ? ` · ${meta.mapCategory.label}` : ''),
    };
  });

  /** The selected region against the EU mean; the EU alone with no selection. */
  protected readonly evolution = computed(() => {
    const { meta, data, breakdown, selected } = this.card();
    const region: Line | undefined = selected
      ? { name: geoName(selected), role: 'region', points: timeSeries(data, selected, breakdown) }
      : undefined;
    const eu: Line = {
      name: 'Media UE',
      role: 'eu',
      points: timeSeries(data, EU_AGGREGATE, breakdown),
    };
    const lines = [region, eu].filter((line): line is Line => !!line && line.points.length > 0);
    const shown = region?.points.length ? `${region.name} frente a la media UE` : 'media UE';
    const index = meta.kind === 'index';
    return {
      option: lineOption({ unit: index ? '' : meta.unit, lines, ...(index ? { base: 100 } : {}) }),
      label: `Evolución de ${meta.label}: ${shown}`,
    };
  });

  /** Split of the selected region, or of the EU with no selection or no data for it. */
  protected readonly split = computed(() => {
    const { meta, data, breakdown, selected, year } = this.card();
    if (year === undefined) return undefined;
    const own = selected ? slicesOf(meta, data, selected, year, breakdown) : [];
    const [geo, slices] = own.length
      ? [geoName(selected ?? ''), own]
      : ['media UE', slicesOf(meta, data, EU_AGGREGATE, year, breakdown)];
    return {
      // The legend of both charts: each category with its colour and its share in the pie.
      categories: slices.map((slice, i) => ({
        label: slice.label,
        colour: CATEGORY_COLOURS[i] ?? '',
        value: formatValue(slice.value, meta.unit),
      })),
      option: pieOption({ unit: meta.unit, slices }),
      label: `Reparto de ${meta.label}: ${geo} en ${year}`,
    };
  });

  /** Every country as a bar, in the order of the category the map paints. */
  protected readonly comparison = computed(() => {
    const { meta, data, breakdown, selected, values, year } = this.card();
    if (year === undefined) return undefined;
    const rows = [...values]
      .sort((a, b) => b.value - a.value)
      .map((entry) => ({
        geo: entry.geo,
        name: geoName(entry.geo),
        slices: slicesOf(meta, data, entry.geo, year, breakdown),
      }));
    return {
      option: stackedBarsOption({
        categories: meta.categories ?? [],
        rows,
        selected: selected && geoName(selected),
      }),
      geos: rows.map((row) => row.geo),
      label: `${meta.label} por país en ${year}`,
      // A readable bar per country, plus room for the legend.
      height: rows.length * 18 + 72,
    };
  });

  /** The bars chart reports the row clicked; only a country's row selects it. */
  protected pickBar(index: number): void {
    const geo = this.comparison()?.geos[index];
    if (geo) this.regionPicked.emit(geo);
  }
}
