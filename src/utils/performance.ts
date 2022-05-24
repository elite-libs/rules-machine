'use strict';

// @license http://opensource.org/licenses/MIT
// copyright Paul Irish 2015
// Added code by Aaron Levine from: https://gist.github.com/Aldlevine/3f716f447322edbb3671
// Some modifications by Joan Alba Maldonado.
// as Safari 6 doesn't have support for NavigationTiming, we use a Date.now() timestamp for relative values
// if you want values similar to what you'd get with real perf.now, place this towards the head of the page
// but in reality, you're just getting the delta between now() calls, so it's not terribly important where it's placed
// Gist: https://gist.github.com/jalbam/cc805ac3cfe14004ecdf323159ecf40e
// TODO: Think about adding vendor prefixes.

const performance = {
  now() {
    // console.warn('Uninitialized performance.now() polyfill');
    return Date.now();
  },
};

// Ancient hack for Safari 6-8 support
// if (!Date.now) {
//   Date.now = function () {
//     return new Date().getTime();
//   };
// }

void (async function() {
  // @ts-expect-error
  if (window?.performance?.now) {
    // @ts-expect-error
    performance.now = () => window.performance.now();
    return;
  }
  // Check for node environment
  try {
    const perfHooks = await import('perf_hooks');
    performance.now = () => perfHooks.performance?.now();
  } catch (error) { /* ignore, couldn't import high-res timer */ }

  // @ts-expect-error
  window.performance = window?.performance || {};
  if (
    // @ts-expect-error
    window?.performance?.timing.navigationStart &&
    // @ts-expect-error
    window?.performance?.mark &&
    // @ts-expect-error
    window?.performance?.clearMarks &&
    // @ts-expect-error
    window?.performance?.getEntriesByName
  ) {
    performance.now = function() {
    // @ts-expect-error
      window?.performance.clearMarks('__PERFORMANCE_NOW__');
      // @ts-expect-error
      window?.performance.mark('__PERFORMANCE_NOW__');
      // @ts-expect-error
      return window.performance.getEntriesByName('__PERFORMANCE_NOW__')[0]
        .startTime;
    };
    // @ts-expect-error
  } else if (!('now' in window.performance)) {
    let nowOffset = Date.now();

    if (
    // @ts-expect-error
      window.performance.timing?.navigationStart
    )
    // @ts-expect-error
      nowOffset = window.performance.timing.navigationStart;

    performance.now = function now() {
      return Date.now() - nowOffset;
    };
  }
})();

export default performance;
