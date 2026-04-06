import { init } from 'expressionparser';
import type { ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';
import { assignmentOperators, ruleExpressionLanguage } from './language';

/**
 * A compiled expression — currently just the raw string, but structured to
 * allow future pre-parsing / AST caching without changing the interface.
 */
export interface CompiledExpression {
  /** The original source string */
  source: string;
  /**
   * The assignment operator found in this expression, if any.
   * e.g. `=`, `+=`, `-=`, `*=`, `/=`, `??=`
   */
  assignmentOperator: string | undefined;
  /**
   * For assignment expressions, the left-hand-side key path.
   * e.g. `"discount"` or `"user.plan"`
   */
  lhs: string | undefined;
}

/**
 * Delegate used by the expression engine to resolve a named term (variable)
 * against the current execution context.
 */
export type TermResolver = (term: string) => ExpressionValue;

/**
 * The public interface for evaluating string expressions.
 * Intentionally knows nothing about Rule structures — it only parses
 * and evaluates expression strings given a runtime context.
 */
export interface ExpressionEngine {
  /**
   * Pre-process an expression string into a `CompiledExpression`.
   * Parsing is O(1) right now (metadata extraction only) and is designed
   * to be the hook for future AST pre-compilation.
   */
  compile(expression: string): CompiledExpression;

  /**
   * Evaluate a previously compiled expression against a runtime context.
   * The `termResolver` is called for every named term encountered during
   * evaluation (variables, key paths, etc.).
   */
  evaluate(
    compiled: CompiledExpression,
    termResolver: TermResolver,
  ): ExpressionValue;

  /**
   * Convenience: compile + evaluate in one call.
   */
  evaluateExpression(
    expression: string,
    termResolver: TermResolver,
  ): ExpressionValue;
}

/**
 * Create a default `ExpressionEngine` backed by `expressionparser` and the
 * built-in `ruleExpressionLanguage` function set.
 */
export function createExpressionEngine(): ExpressionEngine {
  function compile(expression: string): CompiledExpression {
    const assignmentOperator = assignmentOperators.find((op: string) =>
      expression.includes(` ${op} `),
    );
    const lhs = assignmentOperator
      ? expression.split(assignmentOperator, 2)[0].trim()
      : undefined;

    return { source: expression, assignmentOperator, lhs };
  }

  function evaluate(
    compiled: CompiledExpression,
    termResolver: TermResolver,
  ): ExpressionValue {
    const parser = init(ruleExpressionLanguage, (term: string) => {
      if (typeof term !== 'string') throw new Error(`Invalid term: ${term}`);
      return termResolver(term);
    });

    return parser.expressionToValue(compiled.source);
  }

  function evaluateExpression(
    expression: string,
    termResolver: TermResolver,
  ): ExpressionValue {
    return evaluate(compile(expression), termResolver);
  }

  return { compile, evaluate, evaluateExpression };
}
