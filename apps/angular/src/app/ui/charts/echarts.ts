// ECharts with only what the panel cards use, to keep the bundle small.

import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  AriaComponent,
  SVGRenderer,
]);

export { echarts };
