import { describe, it, expect } from 'vitest';
import { cn, formatBRL } from '../utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('deduplicates tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});

describe('formatBRL', () => {
  it('formats cents as BRL', () => {
    // Intl usa espaço não-quebrável entre R$ e o número
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
  });

  it('formats zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
  });
});
