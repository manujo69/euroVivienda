import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterUrlStateAdapter } from './router-url-state.adapter';

describe('RouterUrlStateAdapter', () => {
  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideLocationMocks(), RouterUrlStateAdapter],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    return {
      adapter: TestBed.inject(RouterUrlStateAdapter),
      location: TestBed.inject(Location),
      router: TestBed.inject(Router),
    };
  }

  it('reads the query parameters of the current URL', async () => {
    const { adapter } = await setup('/?ind=tenure,overburden&year=2023&bd=overburden:youth');
    expect(await adapter.read()).toEqual({
      ind: 'tenure,overburden',
      year: '2023',
      bd: 'overburden:youth',
    });
  });

  it('replaces the query, keeping the page and the history as they are', async () => {
    const { adapter, location, router } = await setup('/?ind=tenure&geo=ES');
    const navigate = spyOn(router, 'navigate').and.callThrough();

    await adapter.write({ ind: 'overburden', year: '2025' });

    expect(location.path()).toBe('/?ind=overburden&year=2025');
    expect(navigate.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({ replaceUrl: true }),
    );
  });
});
