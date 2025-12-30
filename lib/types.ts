export type Category = "תיק" | "נעל";

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
  familyName?: string; // First word of bag name (e.g., "VIVIETTE") for filtering
  bagName?: string; // Full bag name from column D (תיאור דגם) for bags
  itemCode?: string; // Full item code (e.g., "BG9536140-COG-OS") for display
}





