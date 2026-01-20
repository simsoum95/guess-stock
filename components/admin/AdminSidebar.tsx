"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useCurrentAdmin } from "@/hooks/useCurrentAdmin";

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  permission?: string; // Permission key to check
};

const allNavigation: NavItem[] = [
  { 
    name: "לוח בקרה", 
    href: "/admin", 
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )
  },
  { 
    name: "רשימת מוצרים", 
    href: "/admin/products",
    permission: "edit_products",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  { 
    name: "הוספת מוצר", 
    href: "/admin/products/new",
    permission: "add_products",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    )
  },
  { 
    name: "ניהול משתמשים", 
    href: "/admin/users",
    permission: "manage_users",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  { 
    name: "בקשות הצעת מחיר", 
    href: "/admin/orders",
    permission: "view_orders",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
];

// Google Sheets link - using the public env variable
const GOOGLE_SHEET_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID 
  ? `https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID}/edit`
  : null;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSuperAdmin, isAdmin, admin, canAccessGoogleSheet, canAddProducts, canEditProducts, canViewOrders, canManageUsers } = useCurrentAdmin();

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return null;
  }

  // Permission check helper
  const hasPermission = (permKey: string): boolean => {
    if (isSuperAdmin) return true;
    const permMap: Record<string, boolean> = {
      edit_products: canEditProducts,
      add_products: canAddProducts,
      manage_users: canManageUsers,
      view_orders: canViewOrders,
    };
    return permMap[permKey] ?? true;
  };

  // Filter navigation based on permissions
  const navigation = allNavigation.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  const handleLogout = async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/admin/login");
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-slate-200 hidden lg:flex lg:flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-slate-900">ניהול קטלוג</p>
            <p className="text-xs text-slate-500">מערכת ניהול</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
          
          {/* Google Sheets Button - only if has permission */}
          {canAccessGoogleSheet && (
            <a
              href={GOOGLE_SHEET_URL || "https://docs.google.com/spreadsheets/d/18-jbOyUgsPAeHkn4ZQ2cioIENugZcYoGRwl_Kh9_uhw/edit"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-green-600 hover:bg-green-50 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                <path d="M8 15h8v2H8zm0-4h8v2H8z"/>
              </svg>
              Google Sheets
            </a>
          )}
        </nav>

        {/* User Info & Logout */}
        <div className="p-3 border-t border-slate-100">
          {admin && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-slate-500 truncate">{admin.email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                isSuperAdmin 
                  ? "bg-purple-100 text-purple-700" 
                  : isAdmin 
                    ? "bg-blue-100 text-blue-700" 
                    : "bg-gray-100 text-gray-700"
              }`}>
                {isSuperAdmin ? "👑 מנהל ראשי" : isAdmin ? "מנהל" : "צופה"}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            התנתקות
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 right-0 left-0 z-50 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-slate-900">ניהול</span>
        </div>
        
        <div className="flex items-center gap-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`p-2 rounded-lg ${
                pathname === item.href ? "bg-blue-50 text-blue-600" : "text-slate-500"
              }`}
            >
              {item.icon}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
