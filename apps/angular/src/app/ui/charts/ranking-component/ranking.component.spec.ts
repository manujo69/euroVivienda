import { TestBed } from '@angular/core/testing';
import type { GeoValue } from '../../../domain/indicator-rules';
import { RankingComponent } from './ranking.component';

const values: GeoValue[] = ['AT', 'BE', 'CZ', 'DE', 'ES', 'FI', 'FR', 'IT'].map((geo, i) => ({
  geo,
  value: i + 0.5,
  flags: undefined,
}));
const eu: GeoValue = { geo: 'EU27_2020', value: 5, flags: undefined };

describe('RankingComponent', () => {
  function render(selected: string | undefined, mean: GeoValue | null = eu) {
    const fixture = TestBed.createComponent(RankingComponent);
    fixture.componentRef.setInput('values', values);
    fixture.componentRef.setInput('eu', mean ?? undefined);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('unit', '%');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const rows = () =>
      [...element.querySelectorAll('tbody tr')].map((row) =>
        [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim()),
      );
    const picked = jasmine.createSpy('picked');
    fixture.componentInstance.picked.subscribe(picked);
    return { element, rows, picked };
  }

  it('lists the top and bottom three with their position, marking the gap between them', () => {
    const { rows } = render(undefined, null);
    expect(rows()).toEqual([
      ['1', 'Italia', '7,5 %'],
      ['2', 'Francia', '6,5 %'],
      ['3', 'Finlandia', '5,5 %'],
      ['…'],
      ['6', 'Chequia', '2,5 %'],
      ['7', 'Bélgica', '1,5 %'],
      ['8', 'Austria', '0,5 %'],
    ]);
  });

  it('adds the selected region in its place and highlights it', () => {
    const { element, rows } = render('DE', null);
    expect(rows().map((row) => row[0])).toEqual(['1', '2', '3', '…', '5', '6', '7', '8']);
    expect(element.querySelector('tr.selected')?.textContent).toContain('Alemania');
  });

  it('draws the EU mean as a labelled line where its value falls', () => {
    const { element, rows } = render(undefined);
    expect(rows()[3]).toEqual(['', 'Media UE', '5,0 %']);
    expect(element.querySelector('tr.eu')).not.toBeNull();
  });

  it('names the regions it is given', () => {
    const fixture = TestBed.createComponent(RankingComponent);
    fixture.componentRef.setInput('values', [{ geo: 'ES30', value: 9, flags: undefined }]);
    fixture.componentRef.setInput('eu', undefined);
    fixture.componentRef.setInput('selected', undefined);
    fixture.componentRef.setInput('unit', '%');
    fixture.componentRef.setInput('names', { ES30: 'Comunidad de Madrid' });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('tbody th')?.textContent?.trim()).toBe('Comunidad de Madrid');
  });

  it('selects a country with its button, pressed on the selected one', () => {
    const { element, picked } = render('DE', null);
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('tbody button')];
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
    ]);

    buttons[0]?.click();

    expect(picked).toHaveBeenCalledWith('IT');
  });
});
