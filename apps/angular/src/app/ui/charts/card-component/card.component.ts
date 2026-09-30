import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Card } from '../../../application/explorer.store';
import { EU_AGGREGATE, timeSeries } from '../../../domain/indicator-rules';
import { flagLabels, geoName } from '../../../domain/labels';
import { formatValue } from '../../map/map-option';
import { type Line, lineOption } from '../chart-options';
import { LineChartComponent } from '../line-chart-component/line-chart.component';
import { RankingComponent } from '../ranking-component/ranking.component';

/** One active indicator in the panel: its headline figure, and its charts when open. */
@Component({
  selector: 'app-card',
  imports: [LineChartComponent, RankingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  readonly card = input.required<Card>();
  readonly opened = output<void>();

  protected readonly figure = computed(() => {
    const { headline, year } = this.card();
    if (!headline) return undefined;
    return {
      value: formatValue(headline.value),
      flags: headline.flags ?? '',
      flagText: flagLabels(headline.flags).join(', '),
      explanation: `${geoName(headline.geo)} en ${year}`,
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
    return {
      option: lineOption({ unit: meta.unit, lines }),
      label: `Evolución de ${meta.label}: ${shown}`,
    };
  });
}
