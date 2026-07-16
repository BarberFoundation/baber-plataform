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
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminUserProps {
  tenantId: string;
  email: string | null;
  phone: string | null;
  firebaseUid: string;
  name: string | null;
}

export interface CreateClientUserProps {
  tenantId: string;
  phone: string;
  firebaseUid: string;
}

export interface CreateInvitedUserProps {
  tenantId: string;
  name: string;
  phone: string;
  role: Extract<Role, 'ADMIN' | 'RECEPTIONIST'>;
}

export class User {
  readonly id: string;
  readonly tenantId: string;
  private _name: string | null;
  readonly role: Role;
  private _phone: string | null;
  readonly email: string | null;
  private _firebaseUid: string | null;
  private _isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this.role = props.role;
    this._phone = props.phone;
    this.email = props.email;
    this._firebaseUid = props.firebaseUid;
    this._isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get name(): string | null {
    return this._name;
  }

  get phone(): string | null {
    return this._phone;
  }

  get firebaseUid(): string | null {
    return this._firebaseUid;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  /** Vincula conta Firebase a um usuário legado (criado sem login). Uid existente nunca é sobrescrito. */
  linkFirebaseUid(firebaseUid: string): void {
    if (this._firebaseUid) {
      throw new Error('Usuário já está vinculado a uma conta Firebase.');
    }
    this._firebaseUid = firebaseUid;
  }

  rename(name: string | null): void {
    this._name = name;
  }

  updatePhone(phone: string | null): void {
    this._phone = phone;
  }

  deactivate(): void {
    this._isActive = false;
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
      phone: props.phone,
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
      firebaseUid: props.firebaseUid,
      createdAt: now,
      updatedAt: now,
    });
  }

  static createInvited(props: CreateInvitedUserProps): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: props.name,
      role: props.role,
      phone: props.phone,
      email: null,
      firebaseUid: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}
