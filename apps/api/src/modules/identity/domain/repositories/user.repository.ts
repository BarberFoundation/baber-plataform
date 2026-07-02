import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  findByFirebaseUid(firebaseUid: string, tenantId: string): Promise<User | null>;
  findByPhone(phone: string, tenantId: string): Promise<User | null>;
  findById(id: string, tenantId: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
