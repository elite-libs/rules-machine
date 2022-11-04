import type { Rule } from '@elite-libs/rules-machine';

export type FieldPath = string | true;
export interface FieldKeyMapping {
  [key: string]: FieldPath | FieldKeyMapping;
}

/**
 * An associated set of rules & their needed input values.
 */
export interface RuleMapping {
  /**
   * A object, array or string describing a set of logical `Rule`'s
   */
  rules: Readonly<Rule>;
  /**
   * A map of input keys to their key paths from the input object.
   */
  inputMap?: FieldKeyMapping;
  /**
   * Values merged to the output of the rules.
   *
   * When outputMap is an object, the keys are the source value path and the values are the input value's keys.
   * ```
   * {
   *  fromKey: 'toKey.path.string[0]'
   * }
   * ```
   *
   * When outputMap is a string, it's treated as a destination path for the entire rules output.
   */
  outputMap?: string | FieldKeyMapping;
}

export type RulesCallback = <TOutput = unknown>(
  input: Readonly<object>,
  skipDataMapping?: boolean,
) => TOutput;
