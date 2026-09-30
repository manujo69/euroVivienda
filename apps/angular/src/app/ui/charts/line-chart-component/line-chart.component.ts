import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { echarts } from '../echarts';

/** An ECharts chart for the cards; ngx-echarts resizes it with a ResizeObserver. */
@Component({
  selector: 'app-line-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss',
})
export class LineChartComponent {
  readonly option = input.required<EChartsCoreOption>();
  /** What the chart shows, for screen readers. */
  readonly label = input.required<string>();
}
