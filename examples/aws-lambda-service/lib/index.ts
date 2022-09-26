/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-param-reassign */
import { ruleFactory } from '@elite-libs/rules-machine';
import { mapValues, flow } from 'lodash';
import { tap } from 'lodash/fp';
import { inputAdapter, outputAdapter } from './transformers';
import { RuleMapping, RulesCallback } from './types';

/**
 *
 * ### Examples
 *
 * To run `rules` named `search` rule set:
 *
 * ```ts
 * import appRules from './rules/app-rules';
 *
 * export const rulesMachine: Record<keyof typeof appRules, RulesCallback> = rulesMachineFactory(appRules);
 *
 * const result = rulesMachine.getDiscount<{ price: number }>(input);
 * result.price; // TS sees the type you annotated above!
 * ```
 *
 * ### Overview
 *
 * `rulesMachineFactory` converts a dictionary of labeled rules into an object with named functions corresponding with their rules.
 *
 * The `RuleMapping` and `rulesEngineFactory` help enhance the base Rules Engine functionality with pre & post data transformations.
 *
 * > Note: Lodash methods `get` and `set` used for reading & writing to structured data.
 *
 * - Each `RuleMapping` features:
 *   - An `inputMap` to help utilize complex business domain objects, while keeping your Rules logic readable with flat objects.
 *   - The `outputMap` is similar to `inputMap` except it copies values from the rules output back to the `input` object. (Mutates it in-place.)
 *
 */
export function rulesMachineFactory(ruleSet: Record<string, RuleMapping>) {
  return mapValues(ruleSet, convertRuleMapping);
}

function convertRuleMapping({
  inputMap,
  outputMap,
  rules,
}: RuleMapping): RulesCallback {
  return <TOutput = unknown>(
    input: object,
    skipDataMapping = false
  ): TOutput => {
    const processInputArgs = (inputArgs: object) =>
      skipDataMapping ? inputArgs : inputAdapter(inputMap, inputArgs);
    const applyOutputUpdates = (result: any) => {
      if (!skipDataMapping && outputMap)
        outputAdapter(outputMap, result, input);
    };

    return flow(
      processInputArgs,
      // @ts-expect-error
      ruleFactory(rules),
      tap(applyOutputUpdates)
    )(input) as unknown as TOutput;
  };
}
