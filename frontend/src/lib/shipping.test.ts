import { describe, expect, test } from 'bun:test';
import { guessZoneFromCity, resolveShipping } from './shipping';

describe('guessZoneFromCity', () => {
  test('detects Panama City variants regardless of accents/case', () => {
    expect(guessZoneFromCity('Panamá')).toBe('capital');
    expect(guessZoneFromCity('panama')).toBe('capital');
    expect(guessZoneFromCity('Ciudad de Panamá')).toBe('capital');
  });

  test('detects known metro-area districts', () => {
    expect(guessZoneFromCity('San Miguelito')).toBe('capital');
    expect(guessZoneFromCity('La Chorrera')).toBe('capital');
    expect(guessZoneFromCity('Tocumen')).toBe('capital');
  });

  test('falls back to interior for anything else', () => {
    expect(guessZoneFromCity('David')).toBe('interior');
    expect(guessZoneFromCity('Santiago')).toBe('interior');
    expect(guessZoneFromCity('Colón')).toBe('interior');
  });

  test('defaults to capital when the city is empty', () => {
    expect(guessZoneFromCity('')).toBe('capital');
    expect(guessZoneFromCity('   ')).toBe('capital');
  });
});

describe('resolveShipping', () => {
  test('pickup is always free regardless of subtotal', () => {
    expect(resolveShipping('pickup', 'standard', 10).cost).toBe(0);
  });

  test('free shipping over the threshold', () => {
    expect(resolveShipping('capital', 'express', 50).cost).toBe(0);
  });

  test('charges the zone/speed rate below the threshold', () => {
    expect(resolveShipping('capital', 'standard', 10).cost).toBe(3.5);
    expect(resolveShipping('interior', 'express', 10).cost).toBe(14.9);
  });
});
