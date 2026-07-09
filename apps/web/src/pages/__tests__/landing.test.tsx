import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../landing';

vi.mock('animejs', () => ({
  animate: vi.fn(() => ({ pause: vi.fn() })),
  stagger: vi.fn(() => 0),
  split: vi.fn(() => ({ words: [] })),
  onScroll: vi.fn(() => ({})),
}));

describe('LandingPage', () => {
  it('renders hero, features, and a final CTA link to /login', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/agendamento inteligente/i)).toBeInTheDocument();
    const ctaLinks = screen.getAllByRole('link', { name: /come(c|ç)ar agora|criar conta|entrar/i });
    expect(ctaLinks.length).toBeGreaterThan(0);
    expect(ctaLinks[0]).toHaveAttribute('href', '/login');
  });
});
