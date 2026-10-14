import { init } from 'expressionparser';
import type { ExpressionThunk, ExpressionValue } from 'expressionparser/dist/ExpressionParser.js';
import { ruleExpressionLanguage } from './language';
import { extractAssignment } from './assignment';
import { UserError } from '../utils/errors';

/**
 * Public expression metadata. Parsed syntax is cached privately by the engine.
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
   * Metadata extraction is cached; syntax is prepared lazily on evaluation.
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
  // Cache syntax only: every evaluation resolves terms against its current context.
  // A bounded factory-local cache avoids retaining arbitrary unique user programs.
  const cacheLimit = 512;
  const syntax = new Map<string, { metadata: CompiledExpression; thunk?: ExpressionThunk }>();
  let activeResolver: TermResolver | undefined;
  const parser = init(ruleExpressionLanguage, (term: string) => {
    if (typeof term !== 'string') throw new Error(`Invalid term: ${term}`);
    if (!activeResolver) throw new Error('Expression evaluated without a resolver');
    return activeResolver(term);
  });

  function validateSource(source: string) {
    if (source.length > 100_000) throw new UserError('Expression exceeds maximum length of 100000 characters');
    let depth = 0;
    let quote = '';
    if (!source.trim()) throw new UserError('Expression must not be empty');
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
      } else if (ch === '&' || ch === '|') throw new UserError('Unsupported operator: use AND or OR');
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(' || ch === '[') {
        if (++depth > 100) throw new UserError('Expression exceeds maximum nesting depth of 100');
      } else if (ch === ')' || ch === ']') depth--;
    }
  }

  function entry(source: string) {
    let cached = syntax.get(source);
    if (!cached) {
      validateSource(source);
      cached = { metadata: { source, ...extractAssignment(source) } };
      if (syntax.size >= cacheLimit) syntax.delete(syntax.keys().next().value!);
      syntax.set(source, cached);
    }
    return cached;
  }

  function compile(expression: string): CompiledExpression {
    // Metadata is public and mutable; do not let callers modify cached state.
    return { ...entry(expression).metadata };
  }

  function evaluate(
    compiled: CompiledExpression,
    termResolver: TermResolver,
  ): ExpressionValue {
    const previous = activeResolver;
    activeResolver = termResolver;
    try {
      const cached = entry(compiled.source);
      if (!cached.thunk) {
        const source = compiled.source.replace(/^\s*return\s+/, '');
        const tokens = parser.tokenize(source);
        for (let i = 0; i < tokens.length - 1; i++) {
          const token = tokens[i];
          if (tokens[i + 1] === '(' && /^[$A-Z_a-z][$\w.]*$/.test(token)) {
            // This engine exposes only the built-in language's function set.
            // Unknown calls must not degrade to their argument or an undefined term.
            try { if (!parser.getPrefixOp(token)) throw new Error(); }
            catch { throw new UserError(`Unknown function: ${token}`); }
          }
        }
        const rpn = parser.tokensToRpn(tokens);
        const thunk = parser.rpnToThunk(rpn);
        if (rpn.length !== 0) throw new UserError('Invalid expression: unused terms or unsupported syntax');
        cached.thunk = thunk;
      }
      return parser.thunkToValue(cached.thunk);
    } finally {
      // Resolver callbacks may re-enter this engine or throw.
      activeResolver = previous;
    }
  }

  function evaluateExpression(
    expression: string,
    termResolver: TermResolver,
  ): ExpressionValue {
    return evaluate(compile(expression), termResolver);
  }

  return { compile, evaluate, evaluateExpression };
}
