import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { type GeoValue, shortRanking } from '../../../domain/indicator-rules';
import { geoName } from '../../../domain/labels';
import { formatColumn } from '../../map/map-option';

type Row =
  | { kind: 'value'; geo: string; rank: number; name: string; value: string; selected: boolean }
  | { kind: 'eu'; value: string }
  | { kind: 'gap'; key: string };

/** Short ranking of a card: top and bottom three, the selected region and the EU mean. */
@Component({
  selector: 'app-ranking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.scss',
})
export class RankingComponent {
  readonly values = input.required<readonly GeoValue[]>();
  readonly eu = input.required<GeoValue | undefined>();
  readonly selected = input.required<string | undefined>();
  readonly unit = input.required<string>();
  /** Names of the NUTS 2 regions; countries are named by the domain. */
  readonly names = input<Readonly<Record<string, string>>>({});
  /** Code of the country the user picks. */
  readonly picked = output<string>();

  protected readonly rows = computed((): Row[] => {
    const ranked = shortRanking(this.values(), this.selected());
    const eu = this.eu();
    // One format for the whole column, EU mean included.
    const figures = formatColumn(
      [...ranked.map((entry) => entry.value), ...(eu ? [eu.value] : [])],
      this.unit(),
    );
    const rows: Row[] = [];
    let euPending = eu !== undefined;
    ranked.forEach((entry, i) => {
      if (euPending && eu && entry.value < eu.value) {
        rows.push({ kind: 'eu', value: figures.at(-1) ?? '' });
        euPending = false;
      }
      const previous = ranked[i - 1];
      if (previous && entry.rank > previous.rank + 1) rows.push({ kind: 'gap', key: entry.geo });
      rows.push({
        kind: 'value',
        geo: entry.geo,
        rank: entry.rank,
        name: geoName(entry.geo, this.names()),
        value: figures[i] ?? '',
        selected: entry.geo === this.selected(),
      });
    });
    if (euPending) rows.push({ kind: 'eu', value: figures.at(-1) ?? '' });
    return rows;
  });
}
