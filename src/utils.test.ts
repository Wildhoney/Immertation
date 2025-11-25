import { describe, expect, it } from 'vitest';
import { primitive } from './utils';

describe('utils', () => {
  it.each([
    ['string', 'hello', true],
    ['number', 42, true],
    ['boolean', true, true],
    ['null', null, true],
    ['undefined', undefined, true],
    ['symbol', Symbol('test'), true],
    ['bigint', BigInt(123), true],
    ['object', {}, false],
    ['array', [], false],
    ['function', () => {}, false],
  ])('primitive(%s) returns %s', (_, value, expected) => {
    expect(primitive(value)).toBe(expected);
  });
});
