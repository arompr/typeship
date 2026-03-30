import { OrderStatus } from './order-status.enum.js';

/**
 * @publish
 * Payload for placing a new order.
 */
export interface CreateOrderDto {
  userId: string;
  lines: Array<{ productId: string; quantity: number }>;
  status?: OrderStatus;
}
