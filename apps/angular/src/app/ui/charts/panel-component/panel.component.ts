import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ExplorerStore } from '../../../application/explorer.store';
import { CardComponent } from '../card-component/card.component';
import { ScatterComponent } from '../scatter-component/scatter.component';

/** The chart panel: a card per active indicator, at most four open. */
@Component({
  selector: 'app-panel',
  imports: [CardComponent, ScatterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.scss',
})
export class PanelComponent {
  protected readonly store = inject(ExplorerStore);
}
