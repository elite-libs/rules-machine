/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { mapValues, get, set } from 'lodash';
import { RuleMapping } from './types';

/**
 *
 * ### Extracting the first element from an array of objects.
 *
 * ```ts
 * const input = { traceId: 123, users: [{name: 'Mary'}, {name: 'John'}] };
 * const inputMap = { firstUser: 'users[0]', trace: 'traceId' };
 * inputAdapter(inputMap, input);
 * //-> { firstUser: { name: 'Mary' }, trace: 123 }
 * ```
 *
 *
 * ### Unwrapping nested date:
 *
 * ```ts
 * const input = { wrapper: { id: 123 } };
 * const inputMap = { extractedId: 'wrapper.id' };
 *
 * inputAdapter(inputMap, input);
 * //-> { extractedId: 123 }
 * ```
 *
 * @param inputMap  defines the keys to return, and the values to lookup in the input object.
 * @param input
 * @returns
 */

export function inputAdapter<TInput = unknown>(
  inputMap: RuleMapping['inputMap'],
  input: TInput
) {
  return mapValues(inputMap, (lookupKey: string) => get(input, lookupKey));
}

/**
 * This method will mutate the `targetOutput` object.
 *
 * Allows for 'saving' changes back to the **ORIGINAL** rules input.
 *
 * @param keyMapping A map of input keys to their key paths from the input object.
 * @param inputSource The resulting output from running a set of rule(s).
 * @param targetOutput The object to merge the key map values into.
 * @returns
 */
export function outputAdapter<
  TInput extends Record<string, unknown>,
  TOutput extends object
>(
  keyMapping: RuleMapping['outputMap'],
  inputSource: TInput,
  targetOutput: TOutput
) {
  if (typeof keyMapping === 'string')
    keyMapping = { [keyMapping]: true };
  return Object.entries(keyMapping!).reduce((output, [toKey, fromKey]) => {
    set(
      output,
      toKey,
      fromKey === true ? inputSource : get(inputSource, fromKey)
    );
    return output;
  }, targetOutput);
}
