import { createExpressionEngine } from './expression-engine/engine';
import { createRuleExecutor } from './structural-engine/executor';
import type { Rule } from './structural-engine/types';

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

export function ruleFactory<
  TInput extends {
    [k: string]: string | boolean | number | null | undefined | TInput;
  } = any,
>(
  rules: Rule,
  options: RuleMachineOptions | undefined = {
    trace: false,
    ignoreMissingKeys: true,
  },
) {
  if (typeof options === 'string')
    options = { name: options } as RuleMachineOptions;

  const expressionEngine = createExpressionEngine();
  const executor = createRuleExecutor<TInput>(expressionEngine, options);

  return function executeRulePipeline(input: TInput = {} as TInput) {
    return executor.execute(rules, input);
  };
}
