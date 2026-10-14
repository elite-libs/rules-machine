import {
  createExpressionEngine,
  type ExpressionEngineOptions,
} from './expression-engine/engine';
import type {
  ExecutionResult,
  ExecutorOptions,
} from './structural-engine/executor';
import { createRuleExecutor } from './structural-engine/executor';
import type { Rule } from './structural-engine/types';

export type {
  CompiledExpression,
  ExpressionCacheStats,
  ExpressionEngine,
  ExpressionEngineOptions,
  TermResolver,
} from './expression-engine/engine';
export { createExpressionEngine } from './expression-engine/engine';
export type {
  ExecutionResult,
  ExecutorOptions,
  RuleExecutor,
  TraceRow,
} from './structural-engine/executor';
export {
  createRuleExecutor,
  extractValueOrLiteral,
} from './structural-engine/executor';
export type { Rule } from './structural-engine/types';
export type { ExecutionLimits } from './utils/budget';
export { ResourceLimitError } from './utils/budget';

export interface RuleMachineOptions extends ExecutorOptions {
  expression?: ExpressionEngineOptions;
}

export type RulePipeline<TInput> = <TReturn = unknown>(
  input?: TInput,
) => TReturn;
export type TracedRulePipeline<TInput> = <TReturn = unknown>(
  input?: TInput,
) => ExecutionResult<TInput> & { lastValue: TReturn };
export type DynamicRulePipeline<TInput> = <TReturn = unknown>(
  input?: TInput,
) => TReturn | ExecutionResult<TInput>;

export function ruleFactory<
  TInput extends Record<string, unknown> = Record<string, unknown>,
>(
  rules: Rule,
  options: RuleMachineOptions & { trace: true },
): TracedRulePipeline<TInput>;
export function ruleFactory<
  TInput extends Record<string, unknown> = Record<string, unknown>,
>(
  rules: Rule,
  options?: RuleMachineOptions & { trace?: false },
): RulePipeline<TInput>;
export function ruleFactory<
  TInput extends Record<string, unknown> = Record<string, unknown>,
>(rules: Rule, options: RuleMachineOptions): DynamicRulePipeline<TInput>;
export function ruleFactory<
  TInput extends Record<string, unknown> = Record<string, unknown>,
>(rules: Rule, options: RuleMachineOptions = {}): DynamicRulePipeline<TInput> {
  const expressionEngine = createExpressionEngine(options.expression);
  const executor = createRuleExecutor<TInput>(expressionEngine, options);

  return function executeRulePipeline<TReturn = unknown>(
    input: TInput = {} as TInput,
  ): TReturn | ExecutionResult<TInput> {
    return executor.execute<TReturn>(rules, input);
  };
}
