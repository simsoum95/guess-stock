import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  size?: string;
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

    // Préparer les données pour la mise à jour
    const updateData: Record<string, any> = {
      collection: updatedProduct.collection || "",
      category: updatedProduct.category || updatedProduct.subcategory || "",
      subcategory: updatedProduct.subcategory || "",
      brand: updatedProduct.brand || "",
      modelRef: updatedProduct.modelRef || "",
      gender: updatedProduct.gender || "",
      supplier: updatedProduct.supplier || "",
      color: updatedProduct.color || "",
      priceRetail: updatedProduct.priceRetail || 0,
      priceWholesale: updatedProduct.priceWholesale || 0,
      stockQuantity: updatedProduct.stockQuantity || 0,
      imageUrl: updatedProduct.imageUrl || "/images/default.png",
      gallery: updatedProduct.gallery || [],
      productName: updatedProduct.productName || updatedProduct.modelRef || "",
    };

    if (updatedProduct.size !== undefined) {
      updateData.size = updatedProduct.size;
    }

    // Mettre à jour dans Supabase
    let updateQuery = supabase
      .from("products")
      .update(updateData);

    // Utiliser l'ID pour l'update si disponible (plus précis)
    if (updatedProduct.id && updatedProduct.id !== "GUESS") {
      updateQuery = updateQuery.eq("id", updatedProduct.id);
    } else if (updatedProduct.modelRef && updatedProduct.color) {
      updateQuery = updateQuery
        .eq("modelRef", updatedProduct.modelRef)
        .eq("color", updatedProduct.color);
    } else {
      return NextResponse.json(
        { success: false, error: "מזהה מוצר או modelRef+color חסר" },
        { status: 400 }
      );
    }

    const { data, error: updateError } = await updateQuery.select().single();

    if (updateError) {
      console.error("Update product error:", updateError);
      return NextResponse.json(
        { success: false, error: `שגיאה בעדכון המוצר: ${updateError.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "מוצר לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "המוצר עודכן בהצלחה",
      product: data,
    });
  } catch (error: any) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { success: false, error: `שגיאה בעדכון המוצר: ${error.message}` },
      { status: 500 }
    );
  }
}







