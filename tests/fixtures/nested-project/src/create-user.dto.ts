import { UserRole } from './enums.js';
import { Address } from './address.js';

/**
 * @publish
 * A class-based DTO — tests that nested type extraction works for classes,
 * not just interfaces and type aliases.
 */
export class CreateUserDto {
  /** Display name for the new user. */
  name: string = '';
  /** Contact email address. */
  email: string = '';
  /** Initial access role. */
  role: UserRole = UserRole.User;
  /** Billing or shipping address. */
  address: Address = { street: '', city: '', country: '', postalCode: '' };

  /** Returns the user's name and email formatted for display. */
  getDisplayName(): string {
    return `${this.name} <${this.email}>`;
  }

  /** Returns true when the user has the Admin role. */
  isAdmin(): boolean {
    return this.role === UserRole.Admin;
  }
}
