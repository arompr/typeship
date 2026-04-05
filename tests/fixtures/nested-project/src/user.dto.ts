import { UserRole } from './enums.js';
import { Address } from './address.js';

// Local type aliases — not individually marked @publish,
// but should be pulled in transitively as dependencies of UserDto.
export type UserId = string;
export type UserEmail = string;

/**
 * @publish
 * A user DTO that depends on:
 *   - local types (UserId, UserEmail) — same-file nested types
 *   - cross-file @publish types (UserRole from enums.ts, Address from address.ts)
 */
export interface UserDto {
  /** Unique user identifier. */
  id: UserId;
  /** Verified email address. */
  email: UserEmail;
  /** Access role assigned to this user. */
  role: UserRole;
  /** Primary mailing address. */
  address: Address;
  /** Timestamp of account creation (UTC). */
  createdAt: Date;
}
