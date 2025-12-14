"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

interface Admin {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Load existing admins
  useEffect(() => {
    loadAdmins();
  }, []);

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
        body: JSON.stringify({ email: newEmail, password: newPassword }),
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
          <div className="grid gap-4 sm:grid-cols-2">
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
            {admins.map((admin) => (
              <div key={admin.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{admin.email}</p>
                  <p className="text-xs text-slate-500">
                    נוצר: {new Date(admin.created_at).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteAdmin(admin)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="מחיקה"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

