import { OrderStatus } from "./order-status.enum.js";
import { Pagination } from "../shared/pagination.js";

/**
 * @publish
 * A single line item within an order.
 */
export interface OrderLineDto {
  /** ID of the ordered product. */
  productId: string;
  /** Number of units ordered. */
  quantity: number;
  /** Price per unit at time of order, in the account's base currency. */
  unitPrice: number;
}

/**
 * @publish
 * Full order representation returned from the API.
 */
export interface OrderDto {
  /** Unique order identifier. */
  id: string;
  /** ID of the user who placed the order. */
  userId: string;
  /** Current lifecycle status. */
  status: OrderStatus;
  /** Ordered line items. */
  lines: OrderLineDto[];
  /** Sum of all line items (quantity × unitPrice). */
  totalAmount: number;
  /** Timestamp when the order was created (UTC). */
  createdAt: Date;
}

/** @publish */
export interface OrderListResponse {
  items: OrderDto[];
  pagination: Pagination;
}
