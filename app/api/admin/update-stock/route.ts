import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface Product {
  id: string;
  stockQuantity: number;
  [key: string]: unknown;
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

    const body = await request.json();
    const { productId, stockQuantity } = body;

    if (!productId || stockQuantity === undefined) {
      return NextResponse.json(
        { success: false, error: "נתונים חסרים" },
        { status: 400 }
      );
    }

    if (stockQuantity < 0) {
      return NextResponse.json(
        { success: false, error: "מלאי לא יכול להיות שלילי" },
        { status: 400 }
      );
    }

    const productsPath = path.join(process.cwd(), "data", "products.json");
    const productsData = fs.readFileSync(productsPath, "utf-8");
    const products: Product[] = JSON.parse(productsData);

    const productIndex = products.findIndex((p) => p.id === productId);
    if (productIndex === -1) {
      return NextResponse.json(
        { success: false, error: "מוצר לא נמצא" },
        { status: 404 }
      );
    }

    const oldStock = products[productIndex].stockQuantity;
    products[productIndex].stockQuantity = stockQuantity;

    fs.writeFileSync(productsPath, JSON.stringify(products, null, 4), "utf-8");

    return NextResponse.json({
      success: true,
      message: `מלאי עודכן: ${oldStock} → ${stockQuantity}`,
      product: {
        id: productId,
        oldStock,
        newStock: stockQuantity,
      },
    });
  } catch (error) {
    console.error("Update stock error:", error);
    return NextResponse.json(
      { success: false, error: "שגיאה בעדכון המלאי" },
      { status: 500 }
    );
  }
}

