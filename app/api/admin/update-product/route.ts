import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface Product {
  id: string;
  collection: string;
  category: string;
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
  productName: string;
  size: string;
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const authCookie = request.cookies.get("sb-auth-token");
    if (!authCookie?.value) {
      return NextResponse.json(
        { success: false, error: "לא מורשה" },
        { status: 401 }
      );
    }

    const updatedProduct: Product = await request.json();

    if (!updatedProduct.id) {
      return NextResponse.json(
        { success: false, error: "מזהה מוצר חסר" },
        { status: 400 }
      );
    }

    const productsPath = path.join(process.cwd(), "data", "products.json");
    const productsData = fs.readFileSync(productsPath, "utf-8");
    const products: Product[] = JSON.parse(productsData);

    const productIndex = products.findIndex((p) => p.id === updatedProduct.id);
    if (productIndex === -1) {
      return NextResponse.json(
        { success: false, error: "מוצר לא נמצא" },
        { status: 404 }
      );
    }

    // Mettre à jour le produit
    products[productIndex] = {
      ...products[productIndex],
      ...updatedProduct,
    };

    // Sauvegarder
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 4), "utf-8");

    return NextResponse.json({
      success: true,
      message: "המוצר עודכן בהצלחה",
      product: products[productIndex],
    });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { success: false, error: "שגיאה בעדכון המוצר" },
      { status: 500 }
    );
  }
}

