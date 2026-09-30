import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ExplorerStore } from '../../../application/explorer.store';
import type { GeoValue } from '../../../domain/indicator-rules';
import { flagLabels, geoName } from '../../../domain/labels';
import { formatColumn } from '../../map/map-option';

/** Accessible alternative to the map: every country, highest value first, selectable by keyboard. */
@Component({
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent {
  protected readonly store = inject(ExplorerStore);

  // Countries and EU mean share one format, so every figure has the same decimals.
  private readonly formatted = computed(() => {
    const sorted = [...this.store.values()].sort((a, b) => b.value - a.value);
    const eu = this.store.eu();
    const figures = formatColumn(
      [...sorted, ...(eu ? [eu] : [])].map((entry) => entry.value),
      this.store.meta()?.unit ?? '',
    );
    const row = (entry: GeoValue, i: number) => ({
      geo: entry.geo,
      name: geoName(entry.geo),
      value: figures[i] ?? '',
      // Flags first, then the note, as one sentence-case text: «Provisional. Solo el 2,3 % …».
      flags: sentenceCase(
        [flagLabels(entry.flags).join(', '), entry.note].filter(Boolean).join('. '),
      ),
    });
    return { rows: sorted.map(row), eu: eu && row(eu, sorted.length) };
  });

  protected readonly rows = computed(() => this.formatted().rows);
  protected readonly eu = computed(() => this.formatted().eu);
}

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
