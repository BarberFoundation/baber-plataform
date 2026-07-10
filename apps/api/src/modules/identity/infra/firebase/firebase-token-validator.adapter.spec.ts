import { ConfigService } from '@nestjs/config';
import { FirebaseTokenValidatorAdapter } from './firebase-token-validator.adapter';

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

function makeStubAdapter(): FirebaseTokenValidatorAdapter {
  const config = { get: () => undefined } as unknown as ConfigService;
  return new FirebaseTokenValidatorAdapter(config);
}

describe('FirebaseTokenValidatorAdapter (stub mode)', () => {
  it('decodes uid, email, and phone from the token payload', async () => {
    const adapter = makeStubAdapter();
    const token = fakeJwt({ uid: 'uid-1', email: 'a@b.com', phone_number: '+5511999999999', name: 'A' });

    const result = await adapter.validate(token);

    expect(result).toEqual({ uid: 'uid-1', email: 'a@b.com', phone: '+5511999999999', name: 'A' });
  });

  it('leaves phone undefined when the token has no phone_number claim', async () => {
    const adapter = makeStubAdapter();
    const token = fakeJwt({ uid: 'uid-2', email: 'a@b.com' });

    const result = await adapter.validate(token);

    expect(result.phone).toBeUndefined();
  });
});
