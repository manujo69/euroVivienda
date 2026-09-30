import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { IndicatorMeta } from '@eurovivienda/contract';
import type { Scatter } from '../../../application/explorer.store';
import type { Pair } from '../../../domain/scatter';
import { displayUnit } from '../../map/map-option';
import { ChartComponent } from '../chart-component/chart.component';
import { type ScatterAxis, scatterOption } from '../chart-options';

const R = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Two indicators against each other, with their correlation (spec.md, rule 4). */
@Component({
  selector: 'app-scatter',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scatter.component.html',
  styleUrl: './scatter.component.scss',
})
export class ScatterComponent {
  readonly scatter = input.required<Scatter>();
  /** Axes the user picks, a suggested pair or a free one. */
  readonly pairChosen = output<Pair>();
  /** A region picked on the chart, to select it everywhere. */
  readonly regionPicked = output<string>();

  /** Index of the pair on screen among the suggested ones, -1 if it was chosen by hand. */
  protected readonly suggestedIndex = computed(() => {
    const { pair, suggested } = this.scatter();
    return suggested.findIndex(
      (option) =>
        option.pair.x.id === pair.x.id &&
        option.pair.x.breakdown === pair.x.breakdown &&
        option.pair.y.id === pair.y.id &&
        option.pair.y.breakdown === pair.y.breakdown,
    );
  });

  protected readonly correlation = computed(() => {
    const { r, points, level } = this.scatter();
    if (r === undefined) {
      return 'Sin r: hacen falta al menos tres regiones con dato en los dos ejes.';
    }
    return `r = ${R.format(r)} · ${points.length} ${level === 2 ? 'regiones' : 'países'}`;
  });

  /** The name of each axis, written here: too long for the chart. */
  protected readonly axisNames = computed(() => {
    const { x, y } = this.scatter();
    const name = ({ label, unit, year }: ScatterAxis) =>
      `${label} (${unit}${year === undefined ? '' : `, ${year}`})`;
    return { x: name(axis(x)), y: name(axis(y)) };
  });

  protected readonly chart = computed(() => {
    const { x, y, points, selected, names, label } = this.scatter();
    return {
      option: scatterOption({ x: axis(x), y: axis(y), points, selected, names }),
      label: `Dispersión de ${label}`,
    };
  });

  protected chooseSuggested(event: Event): void {
    const option = this.scatter().suggested[Number((event.target as HTMLSelectElement).value)];
    if (option) this.pairChosen.emit(option.pair);
  }

  protected chooseAxis(side: 'x' | 'y', event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const axis = this.scatter().axes.find((item) => item.id === id);
    if (!axis) return;
    const { pair } = this.scatter();
    this.pairChosen.emit({ ...pair, [side]: { id: axis.id, breakdown: axis.breakdown } });
  }

  protected pickPoint(index: number): void {
    const point = this.scatter().points[index];
    if (point) this.regionPicked.emit(point.geo);
  }
}

/** Axis title: the indicator, its breakdown when it is not the first, unit and year. */
function axis(side: {
  meta: IndicatorMeta;
  breakdown: string;
  year: number | undefined;
}): ScatterAxis {
  const { meta, breakdown, year } = side;
  const named = meta.breakdowns.find((item) => item.id === breakdown);
  const first = meta.breakdowns[0]?.id === breakdown;
  return {
    label: named && !first ? `${meta.label} (${named.label})` : meta.label,
    unit: displayUnit(meta),
    year,
  };
}
