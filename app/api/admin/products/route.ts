import { NextRequest, NextResponse } from "next/server";
import { 
  addProductToSheet, 
  updateProductInSheet, 
  deleteProductFromSheet,
  isWriteConfigured 
} from "@/lib/googleSheetsWrite";

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/products - Add a new product
 */
export async function POST(request: NextRequest) {
  try {
    if (!isWriteConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Google Sheets write is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in environment variables."
      }, { status: 500 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.modelRef) {
      return NextResponse.json({ success: false, error: "modelRef is required" }, { status: 400 });
    }
    if (!body.color) {
      return NextResponse.json({ success: false, error: "color is required" }, { status: 400 });
    }

    const result = await addProductToSheet({
      collection: body.collection,
      subcategory: body.subcategory,
      brand: body.brand,
      modelRef: body.modelRef,
      gender: body.gender,
      supplier: body.supplier,
      color: body.color,
      priceRetail: body.priceRetail,
      stockQuantity: body.stockQuantity,
      priceWholesale: body.priceWholesale
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: "Product added successfully" });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("[API] Error adding product:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

/**
 * PUT /api/admin/products - Update an existing product
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isWriteConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Google Sheets write is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in environment variables."
      }, { status: 500 });
    }

    const body = await request.json();
    
    // Validate required fields for identification
    if (!body.modelRef) {
      return NextResponse.json({ success: false, error: "modelRef is required to identify the product" }, { status: 400 });
    }
    if (!body.originalColor) {
      return NextResponse.json({ success: false, error: "originalColor is required to identify the product" }, { status: 400 });
    }

    const result = await updateProductInSheet(body.modelRef, body.originalColor, {
      collection: body.collection,
      subcategory: body.subcategory,
      brand: body.brand,
      gender: body.gender,
      supplier: body.supplier,
      color: body.color,
      priceRetail: body.priceRetail,
      stockQuantity: body.stockQuantity,
      priceWholesale: body.priceWholesale,
      bagName: body.bagName,
      itemCode: body.itemCode,
      category: body.category
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: "Product updated successfully" });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("[API] Error updating product:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/products - Delete a product
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isWriteConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Google Sheets write is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in environment variables."
      }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const modelRef = searchParams.get("modelRef");
    const color = searchParams.get("color");

    if (!modelRef) {
      return NextResponse.json({ success: false, error: "modelRef is required" }, { status: 400 });
    }
    if (!color) {
      return NextResponse.json({ success: false, error: "color is required" }, { status: 400 });
    }

    const result = await deleteProductFromSheet(modelRef, color);

    if (result.success) {
      return NextResponse.json({ success: true, message: "Product deleted successfully" });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error("[API] Error deleting product:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

