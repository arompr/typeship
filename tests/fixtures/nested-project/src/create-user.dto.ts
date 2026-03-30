import { UserRole } from './enums.js';
import { Address } from './address.js';

/**
 * @publish
 * A class-based DTO — tests that nested type extraction works for classes,
 * not just interfaces and type aliases.
 */
export class CreateUserDto {
  name: string = '';
  email: string = '';
  role: UserRole = UserRole.User;
  address: Address = { street: '', city: '', country: '', postalCode: '' };

  getDisplayName(): string {
    return `${this.name} <${this.email}>`;
  }

  isAdmin(): boolean {
    return this.role === UserRole.Admin;
  }
}
