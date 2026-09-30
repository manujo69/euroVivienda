import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { echarts } from '../echarts';

/** An ECharts chart for the cards; ngx-echarts resizes it with a ResizeObserver. */
@Component({
  selector: 'app-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss',
})
export class ChartComponent {
  readonly option = input.required<EChartsCoreOption>();
  /** What the chart shows, for screen readers. */
  readonly label = input.required<string>();
  /** In px: a chart needs a fixed height, its width follows the card. */
  readonly height = input(200);
  /** Index of the data item clicked, e.g. the row of a bar chart. */
  readonly picked = output<number>();
}
