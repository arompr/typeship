import { OrderStatus } from './order-status.enum.js';

/**
 * @publish
 * Payload for placing a new order.
 */
export interface CreateOrderDto {
  /** ID of the user placing the order. */
  userId: string;
  /** List of products and quantities. */
  lines: Array<{ productId: string; quantity: number }>;
  /** Initial status override; defaults to Pending when omitted. */
  status?: OrderStatus;
}
