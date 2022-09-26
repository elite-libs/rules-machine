/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-use-before-define */
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

var window: any = typeof window !== 'undefined' ? window : {};

void (async function() {
  if (window?.performance?.now) {
    performance.now = () => window.performance.now();
    return;
  }
  try {
    // Check for node environment
    const perfHooks = await import('perf_hooks');
    performance.now = () => perfHooks.performance?.now();
  } catch (error) {
    /* ignore, couldn't import high-res timer */
  }
})();

export default performance;
