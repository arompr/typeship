import { UserRole } from './user.dto.js';

/**
 * @publish
 * DTO for creating a new user.
 */
export interface CreateUserDto {
  /** Must be a unique, valid email address. */
  email: string;
  /** Display name shown in the UI. */
  name: string;
  /** Initial access role. */
  role: UserRole;
  /** Plain-text password (will be hashed server-side). */
  password: string;
}
