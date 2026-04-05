import { Pagination, SortOrder } from '../shared/pagination.js';

/**
 * @publish
 * Access control roles for users.
 */
export enum UserRole {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

/**
 * @publish
 * Full user representation returned from the API.
 */
export interface UserDto {
  /** Unique user identifier. */
  id: string;
  /** Verified email address. */
  email: string;
  /** Display name. */
  name: string;
  /** Access role assigned to this user. */
  role: UserRole;
  /** Timestamp of account creation (UTC). */
  createdAt: Date;
}

/** @publish */
export interface UpdateUserDto {
  /** New display name, if changing. */
  name?: string;
  /** New role, if changing. */
  role?: UserRole;
}

/**
 * @publish
 * Paginated response for listing users.
 */
export interface UserListResponse {
  /** Page of user results. */
  items: UserDto[];
  pagination: Pagination;
  sort: SortOrder;
}
