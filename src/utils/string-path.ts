/*!
Copyright OpenJS Foundation and other contributors <https://openjsf.org/>

Based on Underscore.js, copyright Jeremy Ashkenas,
DocumentCloud and Investigative Reporters & Editors <http://underscorejs.org/>

This software consists of voluntary contributions made by many
individuals. For exact contribution history, see the revision history
available at https://github.com/lodash/lodash

The following license applies to all parts of this software except as
documented below:



Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// String-path grammar adapted from Lodash 4.18.1 _stringToPath.js.
// Callers supply strings; general lodash value coercion is intentionally absent.
const propertyName =
  /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
const escapeCharacter = /\\(\\)?/g;
const cache = new Map<string, string[]>();
const maxEntries = 500;
const maxCacheBytes = 1024 * 1024;
const maxEntryBytes = 16 * 1024;
let cacheBytes = 0;

/** Parse string paths with a bounded cache and return independently mutable keys. */
export function stringToPath(source: string): string[] {
  const cached = cache.get(source);
  if (cached) return cached.slice();
  const result: string[] = [];
  if (source.charCodeAt(0) === 46) result.push('');
  source.replace(propertyName, (match, number, quote, substring: string) => {
    result.push(
      quote ? substring.replace(escapeCharacter, '$1') : number || match,
    );
    return match;
  });
  // Conservative string-content accounting, not a VM heap-size guarantee.
  const bytes =
    2 * (source.length + result.reduce((sum, key) => sum + key.length, 0));
  if (bytes <= maxEntryBytes) {
    if (cache.size >= maxEntries || cacheBytes + bytes > maxCacheBytes) {
      cache.clear();
      cacheBytes = 0;
    }
    cache.set(source, result);
    cacheBytes += bytes;
    return result.slice();
  }
  return result;
}
