import { init } from 'expressionparser';
import type {
  ExpressionThunk,
  ExpressionValue,
} from 'expressionparser/dist/ExpressionParser.js';
import {
  checkArrayLength,
  consumeWork,
  currentExecutionBudget,
  ExecutionBudget,
  type ExecutionLimits,
  withExecutionBudget,
} from '../utils/budget';
import { UserError } from '../utils/errors';
import { extractAssignment } from './assignment';
import { ruleExpressionLanguage } from './language';
import { num } from './language-utils';
import { createMaterializer } from './materialize';

export interface ExpressionEngineOptions {
  maxTokens?: number;
  maxCacheEntries?: number;
  /** Conservative source/token accounting, not a VM heap-size guarantee. */
  maxCacheBytes?: number;
  limits?: ExecutionLimits;
}

export interface ExpressionCacheStats {
  entries: number;
  estimatedBytes: number;
  maxEntries: number;
  maxBytes: number;
}

/**
 * Public expression metadata. Parsed syntax is cached privately by the engine.
 */
export interface CompiledExpression {
  /** The original source string */
  source: string;
  /** Right-hand expression for assignments; absent for pure expressions. */
  rhs?: string;
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
export type TermResolver = (term: string) => unknown;

/**
 * The public interface for evaluating string expressions.
 * Intentionally knows nothing about Rule structures — it only parses
 * and evaluates expression strings given a runtime context.
 */
export interface ExpressionEngine {
  /**
   * Pre-process an expression string into a `CompiledExpression`.
   * Metadata and validated syntax are prepared and cached together.
   */
  compile(expression: string): CompiledExpression;

  /**
   * Evaluate a previously compiled expression against a runtime context.
   * The `termResolver` is called for every named term encountered during
   * evaluation (variables, key paths, etc.).
   */
  evaluate(compiled: CompiledExpression, termResolver: TermResolver): unknown;

  /**
   * Convenience: compile + evaluate in one call.
   */
  evaluateExpression(expression: string, termResolver: TermResolver): unknown;
}

/**
 * Create a default `ExpressionEngine` backed by `expressionparser` and the
 * built-in `ruleExpressionLanguage` function set.
 */
export function createExpressionEngine(
  options: ExpressionEngineOptions = {},
): ExpressionEngine & { cacheStats(): ExpressionCacheStats } {
  // Cache syntax only: every evaluation resolves terms against its current context.
  // A bounded factory-local cache avoids retaining arbitrary unique user programs.
  const cacheLimit = options.maxCacheEntries ?? 512;
  const cacheBytes = options.maxCacheBytes ?? 8 * 1024 * 1024;
  const maxTokens = options.maxTokens ?? 1024;
  for (const [name, value] of [
    ['maxCacheEntries', cacheLimit],
    ['maxCacheBytes', cacheBytes],
  ] as const)
    if (!Number.isSafeInteger(value) || value < 0)
      throw new UserError(`${name} must be a nonnegative safe integer`);
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > 1024)
    throw new UserError('maxTokens must be an integer between 1 and 1024');
  type Entry = {
    metadata: CompiledExpression;
    thunk: ExpressionThunk;
    bytes: number;
  };
  const syntax = new Map<string, Entry>();
  let estimatedBytes = 0;
  let activeResolver: TermResolver | undefined;
  const materializer = createMaterializer();
  const parser = init(
    (resolve, typer) => {
      const language = ruleExpressionLanguage(resolve, typer);
      for (const table of [language.INFIX_OPS, language.PREFIX_OPS]) {
        if (typeof table === 'function')
          throw new Error('Budgeted language requires operator tables');
        for (const key of Object.keys(table)) {
          const delegate = table[key];
          table[key] = (...args: ExpressionThunk[]) => {
            consumeWork();
            const result = delegate(
              ...(args as [ExpressionThunk, ExpressionThunk]),
            );
            if (Array.isArray(result)) checkArrayLength(result.length);
            return result;
          };
        }
      }
      return language;
    },
    (term: string) => {
      consumeWork();
      if (typeof term !== 'string') throw new Error(`Invalid term: ${term}`);
      if (!activeResolver)
        throw new Error('Expression evaluated without a resolver');
      return materializer.protect(activeResolver(term)) as ExpressionValue;
    },
  );

  function validateSource(source: string) {
    if (source.length > 100_000)
      throw new UserError(
        'Expression exceeds maximum length of 100000 characters',
      );
    const groups: string[] = [];
    let quote = '';
    if (!source.trim()) throw new UserError('Expression must not be empty');
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
      } else if (ch === '&' || ch === '|')
        throw new UserError('Unsupported operator: use AND or OR');
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(' || ch === '[') {
        groups.push(ch);
        if (groups.length > 100)
          throw new UserError(
            'Expression exceeds maximum nesting depth of 100',
          );
      } else if (ch === ')' || ch === ']') {
        if (groups.pop() !== (ch === ')' ? '(' : '['))
          throw new UserError('Expression contains mismatched grouping');
      }
    }
    if (quote)
      throw new UserError('Expression contains an unterminated string literal');
    if (groups.length)
      throw new UserError('Expression contains unclosed grouping');
  }

  function entry(source: string): Entry {
    const existing = syntax.get(source);
    if (existing) return existing;
    consumeWork(source.length);
    validateSource(source);
    const metadata = { source, ...extractAssignment(source) };
    const parsedSource = (
      metadata.lhs?.includes('[') ? (metadata.rhs ?? '') : source
    ).replace(/^\s*return\s+/, '');
    // The upstream tokenizer merges adjacent symbolic comma/unary operators.
    // Separate argument commas outside literals before tokenization.
    let normalized = '';
    let quote = '';
    for (let index = 0; index < parsedSource.length; index++) {
      const character = parsedSource[index];
      normalized += character;
      if (quote) {
        if (character === '\\' && index + 1 < parsedSource.length)
          normalized += parsedSource[++index];
        else if (character === quote) quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === ',') normalized += ' ';
    }
    const rawTokens = parser.tokenize(normalized);
    if (rawTokens.length > maxTokens)
      throw new UserError(`Expression exceeds maxTokens (${maxTokens})`);
    const tokens: string[] = [];
    for (let i = 0; i < rawTokens.length; i++) {
      if (rawTokens[i] === '[' && rawTokens[i + 1] === ']') {
        tokens.push('EMPTY');
        i++;
      } else tokens.push(rawTokens[i]);
    }
    for (let i = 0; i < tokens.length - 1; i++) {
      const token = tokens[i];
      if (tokens[i + 1] === '(' && /^[$A-Z_a-z][$\w.]*$/.test(token)) {
        if (tokens[i + 2] === ')')
          throw new UserError(`Function ${token} requires an argument`);
        try {
          if (!parser.getPrefixOp(token) && !parser.getInfixOp(token))
            throw new Error();
        } catch {
          throw new UserError(`Unknown function: ${token}`);
        }
      }
    }
    consumeWork(tokens.length);
    const rpn = parser.tokensToRpn(tokens);
    const thunk = parser.rpnToThunk(rpn);
    if (rpn.length)
      throw new UserError(
        'Invalid expression: unused terms or unsupported syntax',
      );
    const bytes =
      256 +
      source.length * 4 +
      tokens.reduce((sum, token) => sum + 256 + token.length * 2, 0);
    const cached = { metadata, thunk, bytes };
    if (cacheLimit > 0 && bytes <= cacheBytes) {
      while (syntax.size >= cacheLimit || estimatedBytes + bytes > cacheBytes) {
        const oldest = syntax.keys().next().value;
        if (oldest === undefined) break;
        estimatedBytes -= syntax.get(oldest)?.bytes ?? 0;
        syntax.delete(oldest);
      }
      syntax.set(source, cached);
      estimatedBytes += bytes;
    }
    return cached;
  }

  function compile(expression: string): CompiledExpression {
    // Metadata is public and mutable; do not let callers modify cached state.
    return { ...entry(expression).metadata };
  }

  function evaluateWithContext(
    compiled: CompiledExpression,
    termResolver: TermResolver,
  ): unknown {
    const previous = activeResolver;
    activeResolver = termResolver;
    try {
      const cached = entry(compiled.source);
      const { lhs, assignmentOperator } = cached.metadata;
      // Bracketed write targets are paths, not array literals in the parser.
      // Resolve their current value separately for compound assignment.
      if (lhs?.includes('[')) {
        if (assignmentOperator === '=')
          return materializer.materialize(cached.thunk);
        const current = termResolver(lhs);
        if (assignmentOperator === '??=')
          return current ?? materializer.materialize(cached.thunk);
        const a = num(current as ExpressionValue);
        const b = num(
          materializer.materialize(cached.thunk) as ExpressionValue,
        );
        switch (assignmentOperator) {
          case '+=':
            return a + b;
          case '-=':
            return a - b;
          case '*=':
            return a * b;
          case '/=':
            return a / b;
          default:
            throw new UserError('Unsupported assignment operator');
        }
      }
      return materializer.materialize(cached.thunk);
    } finally {
      // Resolver callbacks may re-enter this engine or throw.
      activeResolver = previous;
    }
  }

  function evaluate(
    compiled: CompiledExpression,
    resolver: TermResolver,
  ): unknown {
    const existing = currentExecutionBudget();
    if (existing) return evaluateWithContext(compiled, resolver);
    const budget = new ExecutionBudget(options.limits);
    return withExecutionBudget(budget, () => {
      const result = evaluateWithContext(compiled, resolver);
      budget.checkDeadline();
      return result;
    });
  }

  function evaluateExpression(
    expression: string,
    termResolver: TermResolver,
  ): unknown {
    return evaluate(compile(expression), termResolver);
  }

  return {
    compile,
    evaluate,
    evaluateExpression,
    cacheStats: () => ({
      entries: syntax.size,
      estimatedBytes,
      maxEntries: cacheLimit,
      maxBytes: cacheBytes,
    }),
  };
}
