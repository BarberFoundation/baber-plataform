import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Features from '../features';

vi.mock('animejs', () => ({
  onScroll: vi.fn(() => ({})),
  animate: vi.fn(() => ({ pause: vi.fn(), revert: vi.fn() })),
  stagger: vi.fn(() => 0),
}));

describe('Features', () => {
  it('renders four feature cards with titles', () => {
    render(<Features />);
    expect(screen.getByText(/agendamento/i)).toBeInTheDocument();
    expect(screen.getByText(/barbeiros/i)).toBeInTheDocument();
    expect(screen.getByText(/servi(c|ç)os/i)).toBeInTheDocument();
    expect(screen.getByText(/relat(o|ó)rios|dashboard/i)).toBeInTheDocument();
  });
});
