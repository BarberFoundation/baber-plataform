import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  IFirebaseTokenValidator,
  FirebaseTokenPayload,
} from '../../domain/services/firebase-token-validator';

@Injectable()
export class FirebaseTokenValidatorAdapter implements IFirebaseTokenValidator {
  private readonly logger = new Logger(FirebaseTokenValidatorAdapter.name);
  private readonly app: App | null;

  constructor(private readonly config: ConfigService) {
    const projectId = config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      // Reuse existing app if already initialised (hot-reload safe)
      const existingApp = getApps().find((a) => a.name === projectId);
      if (existingApp) {
        this.app = existingApp;
      } else {
        this.app = initializeApp(
          {
            credential: cert({ projectId, clientEmail, privateKey }),
          },
          projectId,
        );
      }
      this.logger.log(`Firebase initialised for project: ${projectId}`);
    } else {
      this.app = null;
      this.logger.warn('FIREBASE_PROJECT_ID not set — running in stub mode (no signature verification)');
    }
  }

  async validate(idToken: string): Promise<FirebaseTokenPayload> {
    if (this.app) {
      const decoded = await getAuth(this.app).verifyIdToken(idToken);
      return {
        uid: decoded.uid,
        email: decoded.email,
        phone: decoded.phone_number,
        name: decoded.name,
      };
    }

    // Stub mode nunca pode rodar em produção — sem verificação de assinatura,
    // qualquer JWT forjado autenticaria.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Firebase stub mode is not allowed in production.');
    }

    // Stub mode: decode without verification
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Stub mode: token is not a valid JWT structure');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as {
      sub?: string;
      uid?: string;
      email?: string;
      phone_number?: string;
      name?: string;
    };
    const uid = payload.uid ?? payload.sub;
    if (!uid) {
      throw new Error('Stub mode: token payload missing uid/sub claim');
    }
    return { uid, email: payload.email, phone: payload.phone_number, name: payload.name };
  }
}
