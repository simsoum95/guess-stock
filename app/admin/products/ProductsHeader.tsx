"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

interface Permissions {
  access_google_sheet: boolean;
  add_products: boolean;
}

interface ProductsHeaderProps {
  productCount: number;
  googleSheetId?: string;
}

export function ProductsHeader({ productCount, googleSheetId }: ProductsHeaderProps) {
  const [permissions, setPermissions] = useState<Permissions>({ access_google_sheet: false, add_products: false });

  useEffect(() => {
    async function loadPermissions() {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
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
              setPermissions({ access_google_sheet: true, add_products: true });
            } else if (data.permissions) {
              setPermissions({
                access_google_sheet: data.permissions.access_google_sheet ?? false,
                add_products: data.permissions.add_products ?? false,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error loading permissions:", err);
      }
    }
    loadPermissions();
  }, []);

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">רשימת מוצרים</h1>
        <p className="text-slate-500 mt-1">{productCount} מוצרים בקטלוג</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Google Sheets Button - only if has permission */}
        {permissions.access_google_sheet && googleSheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${googleSheetId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
              <path d="M8 15h8v2H8zm0-4h8v2H8z"/>
            </svg>
            Google Sheets
          </a>
        )}
        {/* Add Product Button - only if has permission */}
        {permissions.add_products && (
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            הוסף מוצר
          </Link>
        )}
      </div>
    </div>
  );
}

