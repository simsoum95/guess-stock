export type Category = "תיק" | "נעל" | "ביגוד";

export interface Product {
  id: string;
  collection: string;
  category: Category;
  subcategory: string;
  brand: string;
  modelRef: string;
  gender: string;
  supplier: string;
  color: string;
  priceRetail: number;
  priceWholesale: number;
  stockQuantity: number;
  imageUrl: string;
  gallery: string[];
  productName?: string;
  size?: string;
}

