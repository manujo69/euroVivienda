import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ExplorerStore } from '../../../application/explorer.store';
import { byTheme } from '../../../domain/indicator-rules';
import { themeName } from '../../../domain/labels';

/** Indicators by theme, each one switched on and off with its checkbox. */
@Component({
  selector: 'app-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent {
  protected readonly store = inject(ExplorerStore);

  protected readonly groups = computed(() =>
    byTheme(this.store.catalog()).map((group) => ({ ...group, name: themeName(group.theme) })),
  );

  /** The browser ticks the box on click; if the data fails to load, it must go back to the store. */
  protected async toggle(id: string, box: HTMLInputElement): Promise<void> {
    await this.store.toggle(id);
    box.checked = this.store.active().includes(id);
  }
}
