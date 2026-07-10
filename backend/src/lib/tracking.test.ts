import { describe, expect, test } from 'bun:test';
import { carrierLabel, getTrackingUrl } from './tracking';

describe('carrierLabel', () => {
  test('null sin carrier', () => {
    expect(carrierLabel(undefined)).toBeNull();
    expect(carrierLabel('')).toBeNull();
  });

  test('label conocido para un carrier de la lista', () => {
    expect(carrierLabel('dhl')).toBe('DHL');
  });

  test('devuelve el texto tal cual para un carrier fuera de la lista (texto libre)', () => {
    expect(carrierLabel('Mensajería Don Pepe')).toBe('Mensajería Don Pepe');
  });
});

describe('getTrackingUrl', () => {
  test('null sin carrier o sin numero', () => {
    expect(getTrackingUrl(undefined, '123')).toBeNull();
    expect(getTrackingUrl('dhl', undefined)).toBeNull();
  });

  test('arma la URL para un carrier conocido', () => {
    expect(getTrackingUrl('dhl', 'ABC123')).toContain('ABC123');
    expect(getTrackingUrl('ups', 'ABC123')).toContain('ups.com');
  });

  test('null para courier propio (sin plantilla de URL publica)', () => {
    expect(getTrackingUrl('propia', 'ABC123')).toBeNull();
  });

  test('null para un carrier de texto libre no reconocido', () => {
    expect(getTrackingUrl('Mensajería Don Pepe', 'ABC123')).toBeNull();
  });
});
