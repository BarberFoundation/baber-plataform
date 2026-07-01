import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTokenExpired = useAuthStore((s) => s.isTokenExpired);
  if (!accessToken || isTokenExpired()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
