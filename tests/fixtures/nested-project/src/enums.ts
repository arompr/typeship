/** @publish */
export enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}

/**
 * @publish
 * Lifecycle states an order passes through from placement to delivery.
 */
export enum OrderStatus {
  Pending = 'pending',
  Shipped = 'shipped',
  Delivered = 'delivered',
}
