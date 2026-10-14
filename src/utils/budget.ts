import { UserError } from './errors';

export interface ExecutionLimits {
  /** Cooperative work units across structures, expressions and data traversal. */
  maxOperations?: number;
  /** Largest array that an operation may produce or traverse. */
  maxArrayLength?: number;
  /** Cooperative deadline; synchronous host code cannot be preempted. */
  maxDurationMs?: number;
}

export class ResourceLimitError extends UserError {
  name = 'ResourceLimitError';
}

export const defaultExecutionLimits = Object.freeze({
  maxOperations: 1_000_000,
  maxArrayLength: 100_000,
  maxDurationMs: 1_000,
});

export class ExecutionBudget {
  readonly limits: Required<ExecutionLimits>;
  private operations = 0;
  private readonly deadline: number;
  private nextClockCheck = 128;

  constructor(limits: ExecutionLimits = {}) {
    this.limits = { ...defaultExecutionLimits, ...limits };
    for (const [key, value] of Object.entries(this.limits)) {
      if (!Number.isFinite(value) || value <= 0 ||
          (key !== 'maxDurationMs' && !Number.isSafeInteger(value)))
        throw new UserError(`${key} must be a finite positive ${key === 'maxDurationMs' ? 'number' : 'safe integer'}`);
    }
    this.deadline = performance.now() + this.limits.maxDurationMs;
  }

  consume(units = 1) {
    this.operations += units;
    if (!Number.isSafeInteger(this.operations) || this.operations > this.limits.maxOperations)
      throw new ResourceLimitError(`Execution exceeded maxOperations (${this.limits.maxOperations})`);
    if (this.operations >= this.nextClockCheck) {
      this.nextClockCheck = this.operations + 128;
      this.checkDeadline();
    }
  }

  checkDeadline() {
    if (performance.now() > this.deadline)
      throw new ResourceLimitError(`Execution exceeded maxDurationMs (${this.limits.maxDurationMs})`);
  }

  checkArray(length: number) {
    if (length > this.limits.maxArrayLength)
      throw new ResourceLimitError(`Array exceeds maxArrayLength (${this.limits.maxArrayLength})`);
  }
}

let active: ExecutionBudget | undefined;

/** Synchronous dynamic scope, restored for nested executions and exceptions. */
export function withExecutionBudget<T>(budget: ExecutionBudget, run: () => T): T {
  const previous = active;
  active = budget;
  try { return run(); } finally { active = previous; }
}

export function currentExecutionBudget(): ExecutionBudget | undefined { return active; }
export function consumeWork(units = 1): void { active?.consume(units); }
export function checkArrayLength(length: number): void { active?.checkArray(length); }
