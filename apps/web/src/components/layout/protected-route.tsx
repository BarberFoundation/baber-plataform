import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { refreshToken } from '@/lib/api';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTokenExpired = useAuthStore((s) => s.isTokenExpired);
  const [status, setStatus] = useState<'checking' | 'ok' | 'redirect'>('checking');

  useEffect(() => {
    if (accessToken && !isTokenExpired()) { setStatus('ok'); return; }
    // accessToken isn't persisted (see store/auth.ts) — on a fresh page load it's
    // always null here, so re-derive it from the httpOnly refresh cookie.
    refreshToken().then((token) => setStatus(token ? 'ok' : 'redirect'));
  }, [accessToken]);

  if (status === 'checking') return null;
  if (status === 'redirect') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
