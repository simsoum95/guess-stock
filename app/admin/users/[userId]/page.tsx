"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentAdmin } from "@/hooks/useCurrentAdmin";

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: string;
  permissions: Permissions | null;
  created_at: string;
}

const DEFAULT_PERMISSIONS: Permissions = {
  access_google_sheet: false,
  add_products: false,
  edit_products: false,
  edit_images: false,
  view_orders: true,
  process_orders: false,
  delete_orders: false,
  export_orders: false,
  manage_users: false,
};

interface Permissions {
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

const PERMISSION_LABELS: Record<keyof Permissions, { label: string; description: string; category: string }> = {
  access_google_sheet: { 
    label: "גישה ל-Google Sheet", 
    description: "יכול לפתוח את הקישור ל-Google Sheets",
    category: "כללי"
  },
  add_products: { 
    label: "הוספת מוצרים", 
    description: "יכול להוסיף מוצרים חדשים לקטלוג",
    category: "מוצרים"
  },
  edit_products: { 
    label: "עריכת מוצרים", 
    description: "יכול לערוך פרטי מוצרים קיימים",
    category: "מוצרים"
  },
  edit_images: { 
    label: "עריכת תמונות", 
    description: "יכול לשנות תמונות של מוצרים",
    category: "מוצרים"
  },
  view_orders: { 
    label: "צפייה בהזמנות", 
    description: "יכול לראות את רשימת ההזמנות",
    category: "הזמנות"
  },
  process_orders: { 
    label: "טיפול בהזמנות", 
    description: "יכול לסמן הזמנות כ'טופל'",
    category: "הזמנות"
  },
  delete_orders: { 
    label: "מחיקת הזמנות", 
    description: "יכול להעביר הזמנות לסל המחזור",
    category: "הזמנות"
  },
  export_orders: { 
    label: "ייצוא הזמנות", 
    description: "יכול להוריד קבצי Excel של הזמנות",
    category: "הזמנות"
  },
  manage_users: { 
    label: "ניהול משתמשים", 
    description: "יכול להוסיף, לערוך ולמחוק משתמשים",
    category: "מערכת"
  },
};

const ROLE_OPTIONS = [
  { value: "super_admin", label: "מנהל ראשי", color: "bg-purple-100 text-purple-700" },
  { value: "admin", label: "מנהל", color: "bg-blue-100 text-blue-700" },
  { value: "viewer", label: "צופה בלבד", color: "bg-gray-100 text-gray-700" },
];

export default function UserDetailsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const router = useRouter();
  const { isSuperAdmin } = useCurrentAdmin();
  
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadUser();
  }, [userId]);

  async function loadUser() {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      // Initialize permissions with defaults if null
      setUser({
        ...data,
        permissions: data.permissions || DEFAULT_PERMISSIONS
      });
    } catch (err) {
      console.error("Error loading user:", err);
      setError("שגיאה בטעינת המשתמש");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id,
          role: user.role,
          permissions: user.permissions,
        }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      setSuccess("השינויים נשמרו בהצלחה!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(key: keyof Permissions) {
    if (!user) return;
    
    // Don't allow changing manage_users for non-super_admin
    if (key === "manage_users" && user.role !== "super_admin") return;
    
    const currentPermissions = user.permissions || DEFAULT_PERMISSIONS;
    
    setUser({
      ...user,
      permissions: {
        ...currentPermissions,
        [key]: !currentPermissions[key],
      },
    });
  }

  function handleRoleChange(newRole: string) {
    if (!user) return;
    setUser({ ...user, role: newRole });
  }

  // Only super_admin can access this page
  if (!isSuperAdmin) {
    return (
      <div className="p-6 lg:p-8 lg:pt-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">🚫 אין לך הרשאה לצפות בדף זה</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 lg:pt-6">
        <div className="text-center text-slate-500">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 lg:p-8 lg:pt-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">משתמש לא נמצא</p>
        </div>
      </div>
    );
  }

  const isSuperAdminUser = user.role === "super_admin";
  const categories = [...new Set(Object.values(PERMISSION_LABELS).map(p => p.category))];

  return (
    <div className="p-6 lg:p-8 lg:pt-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/users"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">עריכת משתמש</h1>
          <p className="text-slate-500">{user.email}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
          <p className="text-green-600 text-sm">{success}</p>
        </div>
      )}

      {/* Role Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">תפקיד</h2>
        
        {isSuperAdminUser ? (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-medium">
              👑 מנהל ראשי
            </span>
            <span className="text-sm text-slate-500">(לא ניתן לשנות)</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.filter(r => r.value !== "super_admin").map((role) => (
              <button
                key={role.value}
                onClick={() => handleRoleChange(role.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  user.role === role.value
                    ? role.color + " ring-2 ring-offset-2 ring-blue-500"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Permissions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">הרשאות</h2>
        
        {isSuperAdminUser ? (
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-purple-700 text-sm">למנהל ראשי יש גישה מלאה לכל הפונקציות</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-slate-500 mb-3">{category}</h3>
                <div className="space-y-2">
                  {(Object.entries(PERMISSION_LABELS) as [keyof Permissions, typeof PERMISSION_LABELS[keyof Permissions]][])
                    .filter(([, info]) => info.category === category)
                    .map(([key, info]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{info.label}</p>
                          <p className="text-xs text-slate-500">{info.description}</p>
                        </div>
                        <button
                          onClick={() => togglePermission(key)}
                          disabled={key === "manage_users"}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            user.permissions?.[key]
                              ? "bg-green-500"
                              : "bg-slate-300"
                          } ${key === "manage_users" ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                              user.permissions?.[key] ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      {!isSuperAdminUser && (
        <div className="flex justify-end gap-3">
          <Link
            href="/admin/users"
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            ביטול
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור שינויים"}
          </button>
        </div>
      )}
    </div>
  );
}

