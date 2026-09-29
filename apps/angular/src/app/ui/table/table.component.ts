import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ExplorerStore } from '../../application/explorer.store';
import type { GeoValue } from '../../domain/indicator-rules';
import { flagLabels, geoName } from '../../domain/labels';
import { formatColumn } from '../map/map-option';

/** Accessible alternative to the map: every country, highest value first, selectable by keyboard. */
@Component({
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="tabular">
      <colgroup>
        <col class="rank" />
        <col class="country" />
        <col class="value" />
        <col />
      </colgroup>
      <caption class="section-title">
        Datos del mapa ·
        {{
          store.shownYear()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col" class="number">Puesto</th>
          <th scope="col">País</th>
          <th scope="col" class="number" aria-sort="descending">Valor</th>
          <th scope="col" class="notes">Notas</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.geo; let i = $index) {
          <tr [class.selected]="row.geo === store.selected()">
            <td class="number">{{ i + 1 }}</td>
            <th scope="row">
              <button
                type="button"
                [attr.aria-pressed]="row.geo === store.selected()"
                (click)="store.select(row.geo)"
              >
                {{ row.name }}
              </button>
            </th>
            <td class="number">{{ row.value }}</td>
            <td class="notes">{{ row.flags }}</td>
          </tr>
        }
      </tbody>
      @if (eu(); as eu) {
        <tfoot>
          <tr>
            <td></td>
            <th scope="row">Media UE</th>
            <td class="number">{{ eu.value }}</td>
            <td class="notes">{{ eu.flags }}</td>
          </tr>
        </tfoot>
      }
    </table>
  `,
  styles: `
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--size-text);
    }
    caption {
      text-align: left;
    }
    th,
    td {
      padding: 4px 8px;
      text-align: left;
      border-bottom: var(--rule-thin) solid var(--color-rule);
    }
    thead th {
      border-bottom: var(--rule-thin) solid var(--color-rule-strong);
      font-weight: 600;
    }
    /* Narrow figure columns next to the country, so values sit by their row, not by the notes. */
    .rank {
      width: 4.5em;
    }
    .country {
      width: 14em;
    }
    .value {
      width: 7em;
    }
    th.number,
    td.number {
      text-align: right;
    }
    .notes {
      padding-left: 24px;
    }
    tr.selected {
      background: var(--color-selected);
    }
    tr.selected th,
    tr.selected td {
      border-bottom-color: var(--color-rule-strong);
    }
    tfoot th,
    tfoot td {
      border-top: var(--rule-thin) dashed var(--color-rule-strong);
      border-bottom: none;
    }
    button {
      font: inherit;
      color: inherit;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
    }
    button:focus-visible {
      outline: 2px solid var(--color-ink);
      outline-offset: 2px;
    }
  `,
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
