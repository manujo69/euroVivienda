import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Viewport } from './viewport.service';

describe('Viewport', () => {
  /** A media query list the test can switch, as the browser does on resize. */
  function fakeQuery(matches: boolean) {
    const listeners: ((event: { matches: boolean }) => void)[] = [];
    const query = {
      matches,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener),
      removeEventListener: () => undefined,
    };
    return {
      query,
      change: (next: boolean) => listeners.forEach((listener) => listener({ matches: next })),
    };
  }

  it('follows the phone breakpoint of the page', () => {
    const { query, change } = fakeQuery(true);
    const media = spyOn(window, 'matchMedia').and.returnValue(query as unknown as MediaQueryList);

    const viewport = TestBed.inject(Viewport);

    expect(media).toHaveBeenCalledWith('(max-width: 767px)');
    expect(viewport.mobile()).toBeTrue();
    change(false);
    expect(viewport.mobile()).toBeFalse();
  });

  it('is not a phone when rendered on the server', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const media = spyOn(window, 'matchMedia');

    expect(TestBed.inject(Viewport).mobile()).toBeFalse();
    expect(media).not.toHaveBeenCalled();
  });
});
