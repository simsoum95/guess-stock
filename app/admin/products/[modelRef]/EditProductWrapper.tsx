"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ProductForm } from "@/components/admin/ProductForm";
import Link from "next/link";

interface Permissions {
  edit_products: boolean;
  edit_images: boolean;
}

interface EditProductWrapperProps {
  product: {
    modelRef: string;
    productName?: string;
    bagName?: string;
    itemCode?: string;
    brand: string;
    color: string;
    category?: string;
    subcategory: string;
    collection?: string;
    supplier?: string;
    gender?: string;
    priceRetail: number;
    priceWholesale: number;
    stockQuantity: number;
    imageUrl: string;
    gallery?: string[];
  };
}

export function EditProductWrapper({ product }: EditProductWrapperProps) {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPermissions() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data } = await supabase
            .from("admins")
            .select("role, permissions")
            .eq("email", user.email)
            .single();
          
          if (data) {
            // Super admin has all permissions
            if (data.role === "super_admin") {
              setPermissions({ edit_products: true, edit_images: true });
            } else {
              setPermissions(data.permissions || { edit_products: false, edit_images: false });
            }
          }
        }
      } catch (err) {
        console.error("Error loading permissions:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, []);

  if (loading) {
    return <div className="text-center text-slate-500 py-8">טוען...</div>;
  }

  // Check if user has any edit permission
  const canEditProducts = permissions?.edit_products ?? false;
  const canEditImages = permissions?.edit_images ?? false;

  if (!canEditProducts && !canEditImages) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">🚫 אין לך הרשאה לערוך מוצרים</p>
          <Link href="/admin/products" className="text-blue-600 hover:underline mt-2 inline-block">
            חזרה לרשימת מוצרים
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Permission notice */}
      {!canEditProducts && canEditImages && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-700 text-sm">
            ⚠️ יש לך הרשאה לערוך תמונות בלבד. שדות אחרים נעולים.
          </p>
        </div>
      )}
      
      <ProductForm 
        product={product} 
        isEdit 
        canEditProducts={canEditProducts}
        canEditImages={canEditImages}
      />
    </>
  );
}

