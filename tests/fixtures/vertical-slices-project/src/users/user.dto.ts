import { Pagination, SortOrder } from '../shared/pagination.js';

/** @publish */
export enum UserRole {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

/** @publish */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/** @publish */
export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
}

/** @publish */
export interface UserListResponse {
  items: UserDto[];
  pagination: Pagination;
  sort: SortOrder;
}
