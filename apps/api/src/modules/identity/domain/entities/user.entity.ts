import { randomUUID } from 'crypto';
import { Role } from '@shared/auth/roles.decorator';

export interface UserProps {
  id: string;
  tenantId: string;
  name: string | null;
  role: Role;
  phone: string | null;
  email: string | null;
  firebaseUid: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminUserProps {
  tenantId: string;
  email: string | null;
  firebaseUid: string;
  name: string | null;
}

export interface CreateClientUserProps {
  tenantId: string;
  phone: string;
}

export class User {
  readonly id: string;
  readonly tenantId: string;
  private _name: string | null;
  readonly role: Role;
  readonly phone: string | null;
  readonly email: string | null;
  readonly firebaseUid: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this.role = props.role;
    this.phone = props.phone;
    this.email = props.email;
    this.firebaseUid = props.firebaseUid;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get name(): string | null {
    return this._name;
  }

  rename(name: string | null): void {
    this._name = name;
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  static createAdmin(props: CreateAdminUserProps): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: props.name,
      role: 'ADMIN',
      phone: null,
      email: props.email,
      firebaseUid: props.firebaseUid,
      createdAt: now,
      updatedAt: now,
    });
  }

  static createClient(props: CreateClientUserProps): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: null,
      role: 'CLIENT',
      phone: props.phone,
      email: null,
      firebaseUid: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
