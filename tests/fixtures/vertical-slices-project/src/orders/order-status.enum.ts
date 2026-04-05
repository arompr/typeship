/**
 * @publish
 * Lifecycle states an order passes through from placement to delivery.
 */
export enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}
