import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Hero from '../hero';

vi.mock('animejs', () => ({
  animate: vi.fn(() => ({ pause: vi.fn() })),
  stagger: vi.fn(() => 0),
  split: vi.fn(() => ({ words: [] })),
}));

describe('Hero', () => {
  it('renders the headline and a CTA link to /login', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agendar demonstração|come(c|ç)ar agora/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
