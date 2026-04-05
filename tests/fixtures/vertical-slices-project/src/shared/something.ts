/**
 * @publish
 * Shared placeholder type used for demonstrating cross-module references.
 */
export type SomethingShared = {
  /** Current page number (1-based). */
  page: number;
  /** Number of items per page. */
  pageSize: number;
  /** Total number of items across all pages. */
  total: number;
};
