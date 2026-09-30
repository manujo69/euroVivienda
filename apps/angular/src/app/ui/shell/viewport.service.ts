import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Phones get tabs instead of three columns (spec.md, «Experiencia de usuario»). */
const PHONE = '(max-width: 767px)';

/** Whether the page is on a phone, following the browser as the window resizes. */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly phone = signal(false);
  readonly mobile = this.phone.asReadonly();

  constructor() {
    // The prerendered page is the desktop one: there is no window on the server.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const query = window.matchMedia(PHONE);
    this.phone.set(query.matches);
    const listener = (event: { matches: boolean }) => this.phone.set(event.matches);
    query.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
  }
}
