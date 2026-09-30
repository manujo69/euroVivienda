// ECharts with only what the map uses, to keep the bundle small.

import { MapChart } from 'echarts/charts';
import { AriaComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { Geography, MapGeography } from '../../domain/ports';

echarts.use([MapChart, TooltipComponent, AriaComponent, SVGRenderer]);

export { echarts };

const registered = new WeakSet<MapGeography>();

/** Registers regions and context as one map ('nuts0' or 'nuts2'), so both share its frame. */
export function registerMap(name: 'nuts0' | 'nuts2', geography: MapGeography): void {
  if (registered.has(geography)) return;
  const map: Geography = {
    type: 'FeatureCollection',
    features: [...geography.regions.features, ...geography.context.features],
  };
  echarts.registerMap(name, map as Parameters<typeof echarts.registerMap>[1]);
  registered.add(geography);
}
