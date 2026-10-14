import { afterEach, describe, expect, test, vi } from 'vitest';
import { UserError } from '../utils/errors';
import { formatDateISO, parseDate } from './dates';

const clock = Date.UTC(2024, 0, 1);
afterEach(() => vi.restoreAllMocks());

describe('explicit date and duration contract', () => {
  test.each([
    0, -1, 1704067200000, -8_640_000_000_000_000, 8_640_000_000_000_000,
  ])('round trips finite epoch %s', (value) => {
    expect(parseDate(value)).toBe(value);
    expect(parseDate(formatDateISO(value))).toBe(value);
  });

  test('date-only strings are UTC in every host timezone', () => {
    const previous = process.env.TZ;
    try {
      for (const timezone of ['UTC', 'America/Denver', 'Pacific/Auckland']) {
        process.env.TZ = timezone;
        expect(parseDate('2024-01-01')).toBe(clock);
        expect(formatDateISO('2024-01-01')).toBe('2024-01-01T00:00:00.000Z');
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  test('explicit offsets and fractional seconds normalize to UTC', () => {
    expect(parseDate('2024-01-01T02:30:00+02:30')).toBe(clock);
    expect(formatDateISO('2023-12-31T19:00-05:00')).toBe(
      '2024-01-01T00:00:00.000Z',
    );
    expect(formatDateISO('2024-01-01T00:00:00.12Z')).toBe(
      '2024-01-01T00:00:00.120Z',
    );
    expect(parseDate('0000-02-29')).toBe(Date.parse('0000-02-29T00:00:00Z'));
  });

  test.each([
    ['14d', 14 * 86400000],
    ['30d', 30 * 86400000],
    ['1year', 365.25 * 86400000],
    ['+1 year', 365.25 * 86400000],
    ['-2 hours', -7200000],
    ['.5d', 43200000],
    ['10 milliseconds', 10],
  ])('evaluates duration %s against a fresh clock', (value, offset) => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(clock);
    expect(parseDate(value)).toBe(clock + offset);
    now.mockReturnValue(clock + 1000);
    expect(parseDate(value)).toBe(clock + 1000 + offset);
    expect(formatDateISO(value)).toBe(
      new Date(clock + 1000 + offset).toISOString(),
    );
  });

  test.each([
    '',
    'now',
    'nonsense',
    '2024',
    '2024-02-30',
    '2023-02-29',
    '1900-02-29',
    '2024-13-01',
    '2024-00-01',
    '2024-01-00',
    '2024-01-01T00:00:00',
    '2024-01-01 00:00:00Z',
    '2024-01-01T24:00:00Z',
    '2024-01-01T00:60:00Z',
    '2024-01-01T00:00:60Z',
    '2024-01-01T00:00:00+24:00',
    '2024-01-01T00:00:00+00:60',
    '1month',
    'Infinity days',
    '1e3ms',
    null,
    undefined,
    true,
    {},
    new Date(0),
    NaN,
    Infinity,
    -Infinity,
    8_640_000_000_000_001,
  ])('rejects unsupported or invalid date %j', (value) => {
    expect(() => parseDate(value)).toThrow(UserError);
    expect(() => formatDateISO(value)).toThrow(UserError);
  });

  test('validates duration results and does not invoke host coercion', () => {
    expect(() => parseDate('1d', () => 8_640_000_000_000_000)).toThrow(
      UserError,
    );
    expect(() => parseDate('1d', () => Infinity)).toThrow(UserError);
    const method = vi.fn(() => '2024-01-01');
    expect(() => parseDate({ toString: method, valueOf: method })).toThrow(
      UserError,
    );
    expect(method).not.toHaveBeenCalled();
    expect(parseDate(1.9)).toBe(1);
    expect(parseDate(-1.9)).toBe(-1);
  });
});
