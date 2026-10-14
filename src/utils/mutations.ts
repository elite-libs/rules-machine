import { consumeWork, ResourceLimitError } from './budget';

type Entry = { target: object; key: string; descriptor?: PropertyDescriptor };
class MutationJournal {
  readonly entries: Entry[] = [];
  record(target: object, key: string) {
    consumeWork();
    if (this.entries.length >= 100_000)
      throw new ResourceLimitError('Atomic execution exceeded maximum journal entries (100000)');
    this.entries.push({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) });
  }
  rollback(mark: number) {
    while (this.entries.length > mark) {
      const entry = this.entries.pop()!;
      if (entry.descriptor) Object.defineProperty(entry.target, entry.key, entry.descriptor);
      else if (!Reflect.deleteProperty(entry.target, entry.key))
        throw new Error(`Atomic rollback could not restore ${entry.key}`);
    }
  }
}
let active: MutationJournal | undefined;

/** Called immediately before interpreter-owned writes, including array effects. */
export function recordMutation(target: object, key: string, value: unknown) {
  if (!active) return;
  if (Array.isArray(target)) {
    if (key === 'length' && typeof value === 'number' && value < target.length) {
      active.record(target, 'length');
      for (const property of Object.getOwnPropertyNames(target))
        if (/^(0|[1-9]\d*)$/.test(property) && Number(property) >= value)
          active.record(target, property);
      return;
    }
    if (/^(0|[1-9]\d*)$/.test(key) && Number(key) >= target.length && Number(key) < 2 ** 32 - 1)
      active.record(target, 'length');
  }
  active.record(target, key);
}

/** Nested atomic calls use savepoints; outer transactions retain inner writes. */
export function withAtomicWrites<T>(run: () => T): T {
  const previous = active;
  const journal = active ?? new MutationJournal();
  const mark = journal.entries.length;
  active = journal;
  try { return run(); }
  catch (error) {
    try { journal.rollback(mark); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Atomic rollback failed'); }
    throw error;
  } finally { active = previous; }
}
