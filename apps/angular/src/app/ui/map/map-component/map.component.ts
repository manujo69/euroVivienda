/* eslint-disable no-debugger */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ExplorerStore } from '../../../application/explorer.store';
import { codesOf } from '../../../domain/geography';
import { echarts, registerNuts0 } from '../echarts';
import { displayUnit, legendItems, mapOption } from '../map-option';

@Component({
  selector: 'app-map',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
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
      unit: displayUnit(meta),
      signed: meta.kind === 'index',
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
