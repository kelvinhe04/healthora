import { describe, expect, test } from 'bun:test';
import { formatPanamaPhone } from './phone';

describe('formatPanamaPhone', () => {
  test('inserts a dash after the 4th digit', () => {
    expect(formatPanamaPhone('61234567')).toBe('6123-4567');
  });

  test('caps input at 8 digits, ignoring anything typed after', () => {
    expect(formatPanamaPhone('313123123123213213')).toBe('3131-2312');
  });

  test('strips non-digit characters as the user types', () => {
    expect(formatPanamaPhone('+507 6123-4567')).toBe('5076-1234');
  });

  test('leaves short input undashed', () => {
    expect(formatPanamaPhone('612')).toBe('612');
    expect(formatPanamaPhone('6123')).toBe('6123');
  });

  test('empty input stays empty', () => {
    expect(formatPanamaPhone('')).toBe('');
  });
});
