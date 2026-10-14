import ms from 'ms';
import { consumeWork } from '../utils/budget';
import { UserError } from '../utils/errors';

const timeLimit = 8_640_000_000_000_000;
const year = '(?:\\d{4}|[+-]\\d{6})';
const dateOnly = new RegExp(`^(${year})-(\\d{2})-(\\d{2})$`);
const dateTime = new RegExp(
  `^(${year})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,3}))?)?(Z|[+-]\\d{2}:\\d{2})$`,
);
const duration =
  /^[+-]?(?:\d+(?:\.\d+)?|\.\d+) *(?:milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i;

function epoch(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > timeLimit)
    throw new UserError(
      'Date must be finite and within the JavaScript epoch range',
    );
  return Math.trunc(value) || 0;
}

function validCalendar(match: RegExpExecArray): boolean {
  const y = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/** Numbers are epoch milliseconds; strings are ISO dates or unit-bearing durations. */
export function parseDate(
  value: unknown,
  now: () => number = Date.now,
): number {
  if (typeof value === 'number') return epoch(value);
  if (typeof value !== 'string')
    throw new UserError(
      'DATE expects epoch milliseconds, an ISO date, or a duration string',
    );
  consumeWork(value.length);
  const text = value.trim();
  if (text.length <= 100 && duration.test(text)) {
    const offset = (ms as (value: string) => number)(text.replace(/^\+/, ''));
    if (!Number.isFinite(offset)) throw new UserError('Invalid date duration');
    return epoch(now() + offset);
  }
  const only = dateOnly.exec(text);
  const timed = dateTime.exec(text);
  const matched = only ?? timed;
  if (!matched || !validCalendar(matched))
    throw new UserError('Invalid ISO date or duration');
  if (timed) {
    if (
      Number(timed[4]) > 23 ||
      Number(timed[5]) > 59 ||
      Number(timed[6] ?? 0) > 59
    )
      throw new UserError('Invalid ISO date time');
    const zone = timed[8];
    if (
      zone !== 'Z' &&
      (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)
    )
      throw new UserError('Invalid ISO timezone offset');
  }
  return epoch(Date.parse(only ? `${text}T00:00:00.000Z` : text));
}

export function formatDateISO(
  value: unknown,
  now: () => number = Date.now,
): string {
  return new Date(parseDate(value, now)).toISOString();
}
