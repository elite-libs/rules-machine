import { createExpressionEngine } from './expression-engine/engine';
import { createRuleExecutor } from './structural-engine/executor';
import type { Rule } from './structural-engine/types';
import type { ExecutionResult } from './structural-engine/executor';

export { extractValueOrLiteral } from './structural-engine/executor';
export type { Rule } from './structural-engine/types';
export type {
  ExpressionEngine,
  CompiledExpression,
  TermResolver,
} from './expression-engine/engine';
export type {
  RuleExecutor,
  ExecutorOptions,
  ExecutionResult,
  TraceRow,
} from './structural-engine/executor';

interface RuleMachineOptions {
  trace?: boolean;
  ignoreMissingKeys?: boolean;
}

export function ruleFactory<TInput extends Record<string, unknown>>(
  rules: Rule,
  options: RuleMachineOptions = {
    trace: false,
    ignoreMissingKeys: true,
  },
) {
  const expressionEngine = createExpressionEngine();
  const executor = createRuleExecutor<TInput>(expressionEngine, options);

  return function executeRulePipeline<TReturn = unknown>(
    input: TInput = {} as TInput,
  ): TReturn | ExecutionResult<TInput> {
    return executor.execute<TReturn>(rules, input);
  };
}
