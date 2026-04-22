import { describe, it, expect } from 'vitest';
import { compare } from '../src/apps/crm/services/workflow.service';

describe('compare (operator semantics)', () => {
  it('eq returns true for strict equality', () => {
    expect(compare(5, 'eq', 5)).toBe(true);
    expect(compare('a', 'eq', 'a')).toBe(true);
    expect(compare(5, 'eq', '5' as unknown as number)).toBe(false);
  });

  it('neq is the inverse of eq', () => {
    expect(compare(5, 'neq', 5)).toBe(false);
    expect(compare(5, 'neq', 6)).toBe(true);
  });

  it('gt/gte/lt/lte work for numeric values', () => {
    expect(compare(10, 'gt', 5)).toBe(true);
    expect(compare(5, 'gt', 5)).toBe(false);
    expect(compare(5, 'gte', 5)).toBe(true);
    expect(compare(3, 'lt', 5)).toBe(true);
    expect(compare(5, 'lte', 5)).toBe(true);
  });

  it('gt/gte/lt/lte return false for non-numeric operands', () => {
    expect(compare('abc', 'gt', 5)).toBe(false);
    expect(compare(5, 'gt', 'abc' as unknown as number)).toBe(false);
  });

  it('contains finds element in array', () => {
    expect(compare(['a', 'b', 'c'], 'contains', 'b')).toBe(true);
    expect(compare(['a', 'b', 'c'], 'contains', 'z')).toBe(false);
  });

  it('contains finds substring in string', () => {
    expect(compare('hello world', 'contains', 'world')).toBe(true);
    expect(compare('hello', 'contains', 'zzz')).toBe(false);
  });

  it('not_contains is the inverse', () => {
    expect(compare(['a'], 'not_contains', 'b')).toBe(true);
    expect(compare(['a'], 'not_contains', 'a')).toBe(false);
  });

  it('is_empty matches null/undefined/empty string/empty array', () => {
    expect(compare(null, 'is_empty', null)).toBe(true);
    expect(compare(undefined, 'is_empty', null)).toBe(true);
    expect(compare('', 'is_empty', null)).toBe(true);
    expect(compare([], 'is_empty', null)).toBe(true);
    expect(compare('x', 'is_empty', null)).toBe(false);
    expect(compare(0, 'is_empty', null)).toBe(false); // 0 is not empty
  });

  it('is_not_empty is the inverse of is_empty', () => {
    expect(compare('x', 'is_not_empty', null)).toBe(true);
    expect(compare('', 'is_not_empty', null)).toBe(false);
  });

  it('unknown operator returns false', () => {
    expect(compare(1, 'bogus' as never, 1)).toBe(false);
  });
});
