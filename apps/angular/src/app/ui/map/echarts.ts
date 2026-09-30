// ECharts with only what the map uses, to keep the bundle small.

import { MapChart } from 'echarts/charts';
import { AriaComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { Geography, MapGeography } from '../../domain/ports';

echarts.use([MapChart, TooltipComponent, AriaComponent, SVGRenderer]);

export { echarts };

const registered = new WeakSet<MapGeography>();

/** Registers regions and context as one 'nuts0' map, so both share its frame. */
export function registerNuts0(geography: MapGeography): void {
  if (registered.has(geography)) return;
  const map: Geography = {
    type: 'FeatureCollection',
    features: [...geography.regions.features, ...geography.context.features],
  };
  echarts.registerMap('nuts0', map as Parameters<typeof echarts.registerMap>[1]);
  registered.add(geography);
}
