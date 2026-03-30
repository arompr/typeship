import { SomethingShared } from "../shared/something.js";

/** @publish */
export enum ProductCategory {
  Electronics = "electronics",
  Clothing = "clothing",
  Food = "food",
  Books = "books",
}

/** @publish */
export interface ProductDto {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  inStock: boolean;
}

/** @publish */
export interface CreateProductDto {
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
}

/** @publish */
export type Hey = {
  something: SomethingShared;
};
