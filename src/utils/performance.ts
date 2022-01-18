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

// (async function () {
//   // @ts-ignore
//   if (window?.performance?.now) {
//     performance.now = () => window.performance.now();
//     return;
//   }
//   // Check for node environment
//   try {
//     const perf_hooks = await import('perf_hooks');
//     performance.now = () => perf_hooks.performance.now();
//   } catch (error) {/* ignore, couldn't import high-res timer */}

//   window.performance = window.performance || {};

//   if (
//     window.performance.timing &&
//     window.performance.timing.navigationStart &&
//     window.performance.mark &&
//     window.performance.clearMarks &&
//     window.performance.getEntriesByName
//   ) {
//     performance.now = function () {
//       window.performance.clearMarks('__PERFORMANCE_NOW__');
//       window.performance.mark('__PERFORMANCE_NOW__');
//       return window.performance.getEntriesByName('__PERFORMANCE_NOW__')[0]
//         .startTime;
//     };
//   } else if ('now' in window.performance === false) {
//     var nowOffset = Date.now();

//     if (
//       window.performance.timing &&
//       window.performance.timing.navigationStart
//     ) {
//       nowOffset = window.performance.timing.navigationStart;
//     }

//     performance.now = function now() {
//       return Date.now() - nowOffset;
//     };
//   }
// })();

export default performance;
