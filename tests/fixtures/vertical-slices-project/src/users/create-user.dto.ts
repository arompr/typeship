import { UserRole } from './user.dto.js';

/**
 * @publish
 * DTO for creating a new user.
 */
export interface CreateUserDto {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}
