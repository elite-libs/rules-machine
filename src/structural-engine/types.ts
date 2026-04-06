/**
 * All Rule type definitions live here — the structural shape of a rule
 * program, independent of how expressions within it are evaluated.
 */

export interface LogicalRule {
  if: AndRule | OrRule | string;
  then: Rule;
  else?: Rule;
}

export interface AndRule {
  and: (string | AndRule | OrRule)[];
}

export interface OrRule {
  or: (string | AndRule | OrRule)[];
}

export interface MapRule {
  map: string;
  run: Rule;
  set?: string;
}

export interface FilterRule {
  filter: string;
  run: Rule;
  set?: string;
}

export interface EveryRule {
  every: string;
  run: Rule;
  set?: string;
}

export interface SomeRule {
  some: string;
  run: Rule;
  set?: string;
}

export interface FindRule {
  find: string;
  run: Rule;
  set?: string;
}

export interface ReturnRule {
  return: string;
}

export interface TryCatchRule {
  try: Rule;
  catch: Rule;
}

export type Rule =
  | string
  | LogicalRule
  | AndRule
  | OrRule
  | EveryRule
  | SomeRule
  | FindRule
  | MapRule
  | FilterRule
  | ReturnRule
  | TryCatchRule
  | Rule[];
