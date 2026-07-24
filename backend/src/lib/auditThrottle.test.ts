import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { shouldRecordThrottled, __resetAuditThrottleForTests } from './auditThrottle';

describe('shouldRecordThrottled', () => {
  beforeEach(() => {
    __resetAuditThrottleForTests();
  });

  afterEach(() => {
    mock.restore();
  });

  test('permite la primera llamada para una key nueva', () => {
    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(true);
  });

  test('bloquea llamadas repetidas de la misma key dentro de la ventana', () => {
    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(true);
    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(false);
    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(false);
  });

  test('no confunde keys de distintos actores/acciones', () => {
    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(true);
    expect(shouldRecordThrottled('auth.login:user_2', 60_000)).toBe(true);
    expect(shouldRecordThrottled('admin.access:user_1', 60_000)).toBe(true);
  });

  test('permite de nuevo una vez pasada la ventana', () => {
    const nowSpy = mock(() => 1_000);
    const originalNow = Date.now;
    Date.now = nowSpy;

    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(true);
    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(false);

    nowSpy.mockImplementation(() => 1_000 + 60_001);
    expect(shouldRecordThrottled('auth.login:user_1', 60_000)).toBe(true);

    Date.now = originalNow;
  });
});
