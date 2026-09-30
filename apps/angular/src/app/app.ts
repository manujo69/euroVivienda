import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { ExplorerStore } from './application/explorer.store';
import { displayUnit, formatValue } from './ui/map/map-option';
import { CatalogComponent } from './ui/catalog/catalog-component/catalog.component';
import { PanelComponent } from './ui/charts/panel-component/panel.component';
import { MapComponent } from './ui/map/map-component/map.component';
import { TableComponent } from './ui/table/table-component/table.component';

@Component({
  selector: 'app-root',
  imports: [CatalogComponent, MapComponent, PanelComponent, TableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(ExplorerStore);

  /** EU mean as the entry figure; an index shows its change since 2015. */
  protected readonly euFigure = computed(() => {
    const eu = this.store.eu();
    const meta = this.store.meta();
    if (!eu || !meta) return undefined;
    const index = meta.kind === 'index';
    return {
      value: formatValue(eu.value, undefined, index),
      unit: displayUnit(meta),
      since: index ? ', desde 2015' : '',
    };
  });

  constructor() {
    // Data loads in the browser only: the prerendered page is the empty shell.
    afterNextRender(() => void this.store.load());
  }

  protected onLevel(event: Event): void {
    void this.store.setLevel((event.target as HTMLSelectElement).value === '2' ? 2 : 0);
  }

  protected onYear(event: Event): void {
    this.store.setYear(Number((event.target as HTMLSelectElement).value));
  }

  protected onBreakdown(event: Event): void {
    const meta = this.store.meta();
    if (meta) this.store.setBreakdown(meta.id, (event.target as HTMLSelectElement).value);
  }
}
