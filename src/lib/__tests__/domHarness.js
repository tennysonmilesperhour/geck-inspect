// Shared setup for page smoke tests that render real components in jsdom
// with Testing Library (plan item E3 30). A test file opts in with the
// `// @vitest-environment jsdom` line at its top and calls
// installDomHarness() once.
//
// jsdom is a browser without layout, so a few APIs the UI kit (Radix) and
// the pages call are missing. They are filled with inert stand-ins here,
// in one place, so each test does not grow its own copy.
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

export function installDomHarness() {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    });
  }
  class InertObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.ResizeObserver ||= InertObserver;
  window.IntersectionObserver ||= InertObserver;
  globalThis.ResizeObserver ||= InertObserver;
  globalThis.IntersectionObserver ||= InertObserver;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView ||= function scrollIntoView() {};
  // Radix Select and Dialog ask about pointer capture on pointer events.
  Element.prototype.hasPointerCapture ||= () => false;
  Element.prototype.setPointerCapture ||= () => {};
  Element.prototype.releasePointerCapture ||= () => {};

  // Testing Library unmounts after each test on its own only when the
  // runner exposes a global afterEach; this suite imports it instead.
  afterEach(() => {
    cleanup();
    try {
      window.sessionStorage.clear();
      window.localStorage.clear();
    } catch {
      // storage can be unavailable; nothing to clear then
    }
  });
}

// Collects console.error calls so a test can assert the page logged no
// React warning (a missing key, an update on an unmounted component) on
// its happy path. Call inside a test; restored after each test.
export function watchConsoleErrors() {
  const errors = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.map(String).join(' '));
  });
  afterEach(() => spy.mockRestore());
  return errors;
}
