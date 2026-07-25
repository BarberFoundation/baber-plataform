import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { refreshToken } from '@/lib/api';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTokenExpired = useAuthStore((s) => s.isTokenExpired);
  const [status, setStatus] = useState<'checking' | 'ok' | 'redirect'>('checking');

  useEffect(() => {
    if (!accessToken) { setStatus('redirect'); return; }
    if (!isTokenExpired()) { setStatus('ok'); return; }
    refreshToken().then((token) => setStatus(token ? 'ok' : 'redirect'));
  }, []);

  if (status === 'checking') return null;
  if (status === 'redirect') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
