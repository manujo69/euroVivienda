import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Card } from '../../../application/explorer.store';
import { flagLabels, geoName } from '../../../domain/labels';
import { formatValue } from '../../map/map-option';

/** One active indicator in the panel: its headline figure, and its charts when open. */
@Component({
  selector: 'app-card',
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
}
