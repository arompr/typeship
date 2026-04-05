/**
 * @publish
 * Pagination parameters included in list responses.
 */
export type Pagination = {
  /** Current page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Total number of items across all pages. */
  total: number;
};

/**
 * @publish
 * Sort direction for ordered list responses.
 */
export type SortOrder = 'asc' | 'desc';
