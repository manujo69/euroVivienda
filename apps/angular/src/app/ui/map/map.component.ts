import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ExplorerStore } from '../../application/explorer.store';
import { codesOf, echarts, registerNuts0 } from './echarts';
import { legendItems, mapOption } from './map-option';

@Component({
  selector: 'app-map',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="chart"
      echarts
      role="img"
      [attr.aria-label]="
        'Mapa de ' + (store.meta()?.label ?? '') + '. Los datos están en la tabla.'
      "
      [options]="option()"
      (chartClick)="onClick($any($event).name)"
    ></div>
    <ul class="legend" aria-label="Leyenda">
      @for (item of legend(); track item.label) {
        <li><span class="swatch" [style.background]="item.colour"></span>{{ item.label }}</li>
      }
      <li><span class="swatch no-data"></span>Sin dato</li>
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    /* The frame of EU plus context is about 7:5. */
    .chart {
      width: 100%;
      aspect-ratio: 7 / 5;
      max-height: 75vh;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      font-size: var(--size-text-small);
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      width: 14px;
      height: 14px;
      border: var(--rule-thin) solid var(--color-rule);
    }
    .no-data {
      background: repeating-linear-gradient(45deg, var(--color-no-data) 0 3px, #c9c9c9 3px 4px);
    }
  `,
})
export class MapComponent {
  protected readonly store = inject(ExplorerStore);

  protected readonly option = computed(() => {
    const geography = this.store.geography();
    const meta = this.store.meta();
    // ECharts cannot frame a map without features.
    if (!geography?.regions.features.length || !meta) return {};
    registerNuts0(geography);
    return mapOption({
      codes: this.regions(),
      context: codesOf(geography.context),
      values: this.store.values(),
      breaks: this.store.breaks(),
      scale: meta.scale,
      selected: this.store.selected(),
      unit: meta.unit,
      year: this.store.shownYear(),
    }) as EChartsOption;
  });

  private readonly regions = computed(() => {
    const geography = this.store.geography();
    return geography ? codesOf(geography.regions) : [];
  });

  /** Only regions with data are selectable; the grey context is not. */
  protected onClick(code: string): void {
    if (this.regions().includes(code)) this.store.select(code);
  }

  protected readonly legend = computed(() =>
    legendItems(this.store.breaks(), this.store.meta()?.scale ?? 'sequential'),
  );
}
