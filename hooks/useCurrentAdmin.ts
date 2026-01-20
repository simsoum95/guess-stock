"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export type AdminRole = "super_admin" | "admin" | "viewer";

export interface Permissions {
  access_google_sheet: boolean;
  add_products: boolean;
  edit_products: boolean;
  edit_images: boolean;
  view_orders: boolean;
  process_orders: boolean;
  delete_orders: boolean;
  export_orders: boolean;
  manage_users: boolean;
}

// Default permissions for super_admin (all true)
const SUPER_ADMIN_PERMISSIONS: Permissions = {
  access_google_sheet: true,
  add_products: true,
  edit_products: true,
  edit_images: true,
  view_orders: true,
  process_orders: true,
  delete_orders: true,
  export_orders: true,
  manage_users: true,
};

interface CurrentAdmin {
  email: string;
  role: AdminRole;
  userId: string;
  permissions: Permissions;
}

export function useCurrentAdmin() {
  const [admin, setAdmin] = useState<CurrentAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdmin() {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && user.email) {
          const { data: adminData } = await supabase
            .from("admins")
            .select("role, permissions")
            .eq("email", user.email)
            .single();

          if (adminData) {
            const role = adminData.role as AdminRole;
            // Super admin always has all permissions
            const permissions = role === "super_admin" 
              ? SUPER_ADMIN_PERMISSIONS 
              : (adminData.permissions as Permissions) || {};

            setAdmin({
              email: user.email,
              role,
              userId: user.id,
              permissions,
            });
          }
        }
      } catch (error) {
        console.error("Error loading admin:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAdmin();
  }, []);

  const isSuperAdmin = admin?.role === "super_admin";
  const isAdmin = admin?.role === "admin" || isSuperAdmin;
  const isViewer = admin?.role === "viewer";
  const permissions = admin?.permissions;

  // Granular permission checks
  const canAccessGoogleSheet = permissions?.access_google_sheet ?? false;
  const canAddProducts = permissions?.add_products ?? false;
  const canEditProducts = permissions?.edit_products ?? false;
  const canEditImages = permissions?.edit_images ?? false;
  const canViewOrders = permissions?.view_orders ?? false;
  const canProcessOrders = permissions?.process_orders ?? false;
  const canDeleteOrders = permissions?.delete_orders ?? false;
  const canExportOrders = permissions?.export_orders ?? false;
  const canManageUsers = permissions?.manage_users ?? false;

  return {
    admin,
    loading,
    isSuperAdmin,
    isAdmin,
    isViewer,
    permissions,
    // Granular permissions
    canAccessGoogleSheet,
    canAddProducts,
    canEditProducts,
    canEditImages,
    canViewOrders,
    canProcessOrders,
    canDeleteOrders,
    canExportOrders,
    canManageUsers,
  };
}

