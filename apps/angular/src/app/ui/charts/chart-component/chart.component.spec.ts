import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgxEchartsDirective } from 'ngx-echarts';
import { lineOption } from '../chart-options';
import { ChartComponent } from './chart.component';

describe('ChartComponent', () => {
  const option = lineOption({
    unit: '%',
    lines: [{ name: 'Media UE', role: 'eu', points: [{ year: 2015, value: 9, flags: undefined }] }],
  });

  function render(height?: number) {
    const fixture = TestBed.createComponent(ChartComponent);
    fixture.componentRef.setInput('option', option);
    fixture.componentRef.setInput('label', 'Evolución de la sobrecarga');
    if (height !== undefined) fixture.componentRef.setInput('height', height);
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(NgxEchartsDirective));
  }

  it('draws the option it is given', () => {
    const chart = render();
    expect(chart.injector.get(NgxEchartsDirective).options()).toBe(option);
  });

  it('describes the chart for screen readers', () => {
    const element = render().nativeElement as HTMLElement;
    expect(element.getAttribute('role')).toBe('img');
    expect(element.getAttribute('aria-label')).toBe('Evolución de la sobrecarga');
  });

  it('is 200 px high unless told otherwise', () => {
    expect((render().nativeElement as HTMLElement).style.height).toBe('200px');
    expect((render(420).nativeElement as HTMLElement).style.height).toBe('420px');
  });
});
