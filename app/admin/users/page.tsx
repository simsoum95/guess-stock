"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

interface Admin {
  id: string;
  user_id: string;
  email: string;
  role: "super_admin" | "admin" | "viewer";
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  super_admin: { label: "מנהל ראשי", color: "bg-purple-100 text-purple-700" },
  admin: { label: "מנהל", color: "bg-blue-100 text-blue-700" },
  viewer: { label: "צופה בלבד", color: "bg-gray-100 text-gray-700" },
};

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("admin");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Load existing admins and current user
  useEffect(() => {
    loadAdmins();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserEmail(user.email || null);
        // Get role from admins table
        const { data: adminData } = await supabase
          .from("admins")
          .select("role")
          .eq("email", user.email)
          .single();
        
        if (adminData) {
          setCurrentUserRole(adminData.role);
        }
      }
    } catch (err) {
      console.error("Error loading current user:", err);
    }
  }

  async function loadAdmins() {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (err) {
      console.error("Error loading admins:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de la création");
      }

      setSuccess(`Admin "${newEmail}" créé avec succès !`);
      setNewEmail("");
      setNewPassword("");
      loadAdmins(); // Refresh list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteAdmin(admin: Admin) {
    if (!confirm(`Supprimer l'admin "${admin.email}" ?`)) return;

    try {
      const response = await fetch(`/api/admin/users?user_id=${admin.user_id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de la suppression");
      }

      setSuccess(`Admin "${admin.email}" supprimé`);
      loadAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Only super_admin can access this page
  if (currentUserRole !== null && currentUserRole !== "super_admin") {
    return (
      <div className="p-6 lg:p-8 lg:pt-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">🚫 אין לך הרשאה לצפות בדף זה</p>
          <p className="text-red-500 text-sm mt-1">רק מנהל ראשי יכול לנהל משתמשים</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 lg:pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ניהול משתמשים</h1>
        <p className="text-slate-500 mt-1">הוספה ומחיקה של מנהלים</p>
      </div>

      {/* Create New Admin Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">הוספת מנהל חדש</h2>
        
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                אימייל *
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                סיסמה *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="לפחות 6 תווים"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                תפקיד *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="admin">מנהל - גישה מלאה</option>
                <option value="viewer">צופה - קריאה בלבד</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {creating ? "יוצר..." : "הוספת מנהל"}
          </button>
        </form>
      </div>

      {/* Admins List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">רשימת מנהלים ({admins.length})</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-500">טוען...</div>
        ) : admins.length === 0 ? (
          <div className="p-6 text-center text-slate-500">אין מנהלים</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {admins.map((admin) => {
              const roleInfo = ROLE_LABELS[admin.role] || ROLE_LABELS.admin;
              const isSuperAdmin = admin.role === "super_admin";
              const canDelete = currentUserRole === "super_admin" && !isSuperAdmin;
              const canEdit = currentUserRole === "super_admin" && !isSuperAdmin;
              
              return (
                <div key={admin.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{admin.email}</p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        נוצר: {new Date(admin.created_at).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Link
                        href={`/admin/users/${admin.user_id}`}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="עריכת הרשאות"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteAdmin(admin)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="מחיקה"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    {isSuperAdmin && (
                      <span className="text-xs text-purple-600 font-medium">👑 מנהל ראשי</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

