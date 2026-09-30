import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { ExplorerStore } from './application/explorer.store';
import { displayUnit, formatValue } from './ui/map/map-option';
import { CatalogComponent } from './ui/catalog/catalog-component/catalog.component';
import { PanelComponent } from './ui/charts/panel-component/panel.component';
import { Viewport } from './ui/shell/viewport.service';
import { MapComponent } from './ui/map/map-component/map.component';
import { TableComponent } from './ui/table/table-component/table.component';

type Tab = 'catalog' | 'map' | 'charts';

@Component({
  selector: 'app-root',
  imports: [CatalogComponent, MapComponent, PanelComponent, TableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(ExplorerStore);
  protected readonly phone = inject(Viewport).mobile;

  protected readonly tabs: readonly { id: Tab; label: string }[] = [
    { id: 'catalog', label: 'Catálogo' },
    { id: 'map', label: 'Mapa' },
    { id: 'charts', label: 'Gráficos' },
  ];
  /** The tab shown on a phone; not shareable state, so not in the URL. */
  protected readonly currentTab = signal<Tab>('map');
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /** On a phone, only the zone of the chosen tab; on wider screens, all three. */
  protected hidden(zone: Tab): boolean {
    return this.phone() && this.currentTab() !== zone;
  }

  /** WAI-ARIA tabs: arrows move to the next or previous tab, Home and End to the ends. */
  protected onTabKey(event: KeyboardEvent, index: number): void {
    const last = this.tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % this.tabs.length
        : event.key === 'ArrowLeft'
          ? (index + last) % this.tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined;
    const tab = next === undefined ? undefined : this.tabs[next];
    if (!tab || next === undefined) return;
    event.preventDefault();
    this.currentTab.set(tab.id);
    this.tabButtons()[next]?.nativeElement.focus();
  }

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
