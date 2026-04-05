import { SomethingShared } from "../shared/something.js";

/**
 * @publish
 * Product category taxonomy.
 */
export enum ProductCategory {
  Electronics = "electronics",
  Clothing = "clothing",
  Food = "food",
  Books = "books",
}

/**
 * @publish
 * Full product representation returned from the API.
 */
export interface ProductDto {
  /** Unique product identifier. */
  id: string;
  /** Human-readable product name. */
  name: string;
  /** Long-form product description. */
  description: string;
  /** List price in the account's base currency. */
  price: number;
  /** Product category. */
  category: ProductCategory;
  /** Whether the product is available for purchase. */
  inStock: boolean;
}

/**
 * @publish
 * Payload for creating a new product.
 */
export interface CreateProductDto {
  /** Human-readable product name. */
  name: string;
  /** Long-form product description. */
  description: string;
  /** List price in the account's base currency. */
  price: number;
  /** Product category. */
  category: ProductCategory;
}

/** @publish */
export type Hey = {
  something: SomethingShared;
};
