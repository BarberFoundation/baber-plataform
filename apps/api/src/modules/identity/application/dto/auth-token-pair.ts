import { Role } from '@shared/auth/roles.decorator';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthResult extends AuthTokenPair {
  user: {
    id: string;
    name: string | null;
    role: Role;
    email: string | null;
  };
}
