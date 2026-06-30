export const FIREBASE_TOKEN_VALIDATOR = Symbol('IFirebaseTokenValidator');

export interface FirebaseTokenPayload {
  uid: string;
  email: string | undefined;
  name: string | undefined;
}

export interface IFirebaseTokenValidator {
  validate(idToken: string): Promise<FirebaseTokenPayload>;
}
