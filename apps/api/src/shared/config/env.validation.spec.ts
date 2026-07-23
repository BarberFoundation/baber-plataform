import 'reflect-metadata';
import { validateEnv } from './env.validation';

const BASE = {
  DATABASE_URL: 'postgres://localhost/db',
  REDIS_URL: 'redis://localhost',
  JWT_ACCESS_SECRET: 'acc',
  JWT_REFRESH_SECRET: 'ref',
};

describe('validateEnv', () => {
  it('accepts missing Firebase vars outside production', () => {
    expect(() => validateEnv({ ...BASE })).not.toThrow();
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'development' })).not.toThrow();
  });

  it('throws in production when Firebase credentials are missing', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(/FIREBASE_PROJECT_ID/);
    expect(() =>
      validateEnv({ ...BASE, NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'p' }),
    ).toThrow(/FIREBASE_CLIENT_EMAIL/);
  });

  const FIREBASE = {
    FIREBASE_PROJECT_ID: 'p',
    FIREBASE_CLIENT_EMAIL: 'svc@p.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'key',
  };

  it('throws in production when Asaas credentials are missing, even with Firebase set', () => {
    expect(() =>
      validateEnv({ ...BASE, NODE_ENV: 'production', ...FIREBASE }),
    ).toThrow(/ASAAS_API_URL/);
    expect(() =>
      validateEnv({ ...BASE, NODE_ENV: 'production', ...FIREBASE, ASAAS_API_URL: 'https://api.asaas.com/v3' }),
    ).toThrow(/ASAAS_API_KEY/);
  });

  it('accepts production with all Firebase and Asaas credentials', () => {
    expect(() =>
      validateEnv({
        ...BASE,
        NODE_ENV: 'production',
        ...FIREBASE,
        ASAAS_API_URL: 'https://api.asaas.com/v3',
        ASAAS_API_KEY: '$aact_prod_key',
      }),
    ).not.toThrow();
  });
});
