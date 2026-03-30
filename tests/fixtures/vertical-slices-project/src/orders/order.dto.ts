import { OrderStatus } from "./order-status.enum.js";
import { Pagination } from "../shared/pagination.js";

/** @publish */
export interface OrderLineDto {
  productId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * @publish
 * Full order representation returned from the API.
 */
export interface OrderDto {
  id: string;
  userId: string;
  status: OrderStatus;
  lines: OrderLineDto[];
  totalAmount: number;
  createdAt: Date;
}

/** @publish */
export interface OrderListResponse {
  items: OrderDto[];
  pagination: Pagination;
}
