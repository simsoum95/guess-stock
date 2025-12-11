"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface HistoryEntry {
  id: string;
  file_name: string;
  uploaded_at: string;
  stats: {
    updated: number;
    inserted: number;
    unchanged: number;
    stockZeroed: number;
    errors: number;
  };
  changes: Array<{
    modelRef: string;
    color: string;
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  inserted_products: Array<{ modelRef: string; color: string }>;
  zeroed_products: Array<{ modelRef: string; color: string; oldStock: number }>;
  sync_stock_enabled: boolean;
  restored_at?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/admin/history");
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (historyId: string) => {
    if (!confirm("האם אתה בטוח שברצונך לשחזר גרסה זו? פעולה זו תחזיר את כל המוצרים למצב שלפני העדכון.")) {
      return;
    }

    setRestoring(true);
    setRestoreMessage(null);

    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyId }),
      });

      const data = await res.json();

      if (data.success) {
        setRestoreMessage(`✅ ${data.message}`);
        fetchHistory(); // Rafraîchir la liste
        router.refresh();
      } else {
        setRestoreMessage(`❌ שגיאה: ${data.error}`);
      }
    } catch (error: any) {
      setRestoreMessage(`❌ שגיאה: ${error.message}`);
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 pt-20" dir="rtl">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-20" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">היסטוריית עדכונים</h1>
        <p className="text-slate-500 mt-1">5 העדכונים האחרונים</p>
      </div>

      {restoreMessage && (
        <div className={`mb-6 p-4 rounded-lg ${restoreMessage.startsWith("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {restoreMessage}
        </div>
      )}

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500 text-lg">אין היסטוריה עדיין</p>
          <p className="text-slate-400 mt-1">העלה קובץ Excel כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className={`bg-white rounded-xl border ${entry.restored_at ? "border-green-200" : "border-slate-200"} overflow-hidden`}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{entry.file_name}</h3>
                      {entry.restored_at && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                          שוחזר
                        </span>
                      )}
                      {entry.sync_stock_enabled && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                          סנכרון מלאי
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{formatDate(entry.uploaded_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {selectedEntry?.id === entry.id ? "הסתר פרטים" : "הצג פרטים"}
                    </button>
                    <button
                      onClick={() => handleRestore(entry.id)}
                      disabled={restoring}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 rounded-lg transition-colors"
                    >
                      {restoring ? "משחזר..." : "שחזר גרסה"}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-slate-600">עודכנו: <strong>{entry.stats.updated}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm text-slate-600">חדשים: <strong>{entry.stats.inserted}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                    <span className="text-sm text-slate-600">ללא שינוי: <strong>{entry.stats.unchanged}</strong></span>
                  </div>
                  {entry.stats.stockZeroed > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span className="text-sm text-slate-600">מלאי אופס: <strong>{entry.stats.stockZeroed}</strong></span>
                    </div>
                  )}
                  {entry.stats.errors > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm text-slate-600">שגיאות: <strong>{entry.stats.errors}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details (expandable) */}
              {selectedEntry?.id === entry.id && (
                <div className="p-5 bg-slate-50 space-y-4">
                  {/* Changes */}
                  {entry.changes && entry.changes.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2">✏️ שינויים ({entry.changes.length})</h4>
                      <div className="overflow-x-auto max-h-48">
                        <table className="w-full bg-white rounded-lg">
                          <thead className="bg-slate-100">
                            <tr className="text-right text-xs text-slate-500 uppercase">
                              <th className="px-3 py-2">מק״ט</th>
                              <th className="px-3 py-2">צבע</th>
                              <th className="px-3 py-2">שדה</th>
                              <th className="px-3 py-2">קודם</th>
                              <th className="px-3 py-2">חדש</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                            {entry.changes.slice(0, 20).map((change, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 font-mono text-slate-900">{change.modelRef}</td>
                                <td className="px-3 py-2 text-slate-600">{change.color}</td>
                                <td className="px-3 py-2 text-slate-700">{change.field}</td>
                                <td className="px-3 py-2 text-red-600 line-through">{change.oldValue}</td>
                                <td className="px-3 py-2 text-green-600 font-medium">{change.newValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {entry.changes.length > 20 && (
                          <p className="text-sm text-slate-500 mt-2">+ עוד {entry.changes.length - 20} שינויים</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inserted products */}
                  {entry.inserted_products && entry.inserted_products.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2">➕ מוצרים חדשים ({entry.inserted_products.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {entry.inserted_products.slice(0, 10).map((p, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                            {p.modelRef} / {p.color}
                          </span>
                        ))}
                        {entry.inserted_products.length > 10 && (
                          <span className="text-sm text-slate-500">+ עוד {entry.inserted_products.length - 10}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Zeroed products */}
                  {entry.zeroed_products && entry.zeroed_products.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2">📦 מלאי אופס ({entry.zeroed_products.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {entry.zeroed_products.slice(0, 10).map((p, idx) => (
                          <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                            {p.modelRef} (היה: {p.oldStock})
                          </span>
                        ))}
                        {entry.zeroed_products.length > 10 && (
                          <span className="text-sm text-slate-500">+ עוד {entry.zeroed_products.length - 10}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

