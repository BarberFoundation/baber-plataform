import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { useReportRange } from '../report-range';

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={['/app/reports']}>{children}</MemoryRouter>;
}

describe('useReportRange', () => {
  it('defaults to last 30 days', () => {
    const { result } = renderHook(() => useReportRange(), { wrapper });
    expect(result.current.to).toBe(format(new Date(), 'yyyy-MM-dd'));
    expect(result.current.from).toBe(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  });

  it('setRange updates the URL-backed state', () => {
    const { result } = renderHook(() => useReportRange(), { wrapper });
    act(() => result.current.setRange('2026-06-01', '2026-06-30'));
    expect(result.current.from).toBe('2026-06-01');
    expect(result.current.to).toBe('2026-06-30');
  });

  it('ignores malformed params and falls back to defaults', () => {
    function badWrapper({ children }: { children: React.ReactNode }) {
      return <MemoryRouter initialEntries={['/app/reports?from=garbage&to=2026-99-99x']}>{children}</MemoryRouter>;
    }
    const { result } = renderHook(() => useReportRange(), { wrapper: badWrapper });
    expect(result.current.to).toBe(format(new Date(), 'yyyy-MM-dd'));
    expect(result.current.from).toBe(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  });
});
