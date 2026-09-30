import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { ExplorerStore } from './application/explorer.store';
import { formatValue } from './ui/map/map-option';
import { CatalogComponent } from './ui/catalog/catalog-component/catalog.component';
import { MapComponent } from './ui/map/map-component/map.component';
import { TableComponent } from './ui/table/table-component/table.component';

@Component({
  selector: 'app-root',
  imports: [CatalogComponent, MapComponent, TableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(ExplorerStore);

  protected readonly euFigure = computed(() => {
    const eu = this.store.eu();
    return eu && formatValue(eu.value);
  });

  constructor() {
    // Data loads in the browser only: the prerendered page is the empty shell.
    afterNextRender(() => void this.store.load());
  }

  protected onBreakdown(event: Event): void {
    this.store.setBreakdown((event.target as HTMLSelectElement).value);
  }
}
