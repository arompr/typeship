import { UserDto } from './user.dto.js';

/**
 * @publish
 * A generic paginated container. The type parameter is referenced by UserListResponse.
 */
export interface PaginatedResult<T> {
  /** Page of results. */
  items: T[];
  /** Total number of items across all pages. */
  total: number;
  /** Current page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
}

/**
 * @publish
 * Deeply nested: references PaginatedResult (same-file) which is generic over
 * UserDto (cross-file), which itself nests Address and UserRole (cross-file).
 */
export interface UserListResponse {
  /** Paginated user results. */
  data: PaginatedResult<UserDto>;
  /** Opaque request correlation ID. */
  requestId: string;
}
