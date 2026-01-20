"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export type AdminRole = "super_admin" | "admin" | "viewer";

interface CurrentAdmin {
  email: string;
  role: AdminRole;
  userId: string;
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
            .select("role")
            .eq("email", user.email)
            .single();

          if (adminData) {
            setAdmin({
              email: user.email,
              role: adminData.role as AdminRole,
              userId: user.id,
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

  // Permission checks
  const canManageUsers = isSuperAdmin;
  const canManageProducts = isAdmin;
  const canManageOrders = isAdmin;
  const canViewOrders = isAdmin || isViewer;
  const canDeleteOrders = isAdmin;
  const canExportOrders = isAdmin;

  return {
    admin,
    loading,
    isSuperAdmin,
    isAdmin,
    isViewer,
    canManageUsers,
    canManageProducts,
    canManageOrders,
    canViewOrders,
    canDeleteOrders,
    canExportOrders,
  };
}

