import { UserDto } from './user.dto.js';

/**
 * @publish
 * A generic paginated container. The type parameter is referenced by UserListResponse.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * @publish
 * Deeply nested: references PaginatedResult (same-file) which is generic over
 * UserDto (cross-file), which itself nests Address and UserRole (cross-file).
 */
export interface UserListResponse {
  data: PaginatedResult<UserDto>;
  requestId: string;
}
