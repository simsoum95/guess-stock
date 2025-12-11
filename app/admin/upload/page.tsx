"use client";

import { useState, useCallback } from "react";

interface UploadResult {
  success: boolean;
  updated: number;
  inserted: number;
  errors: Array<{ row: number; message: string; data?: any }>;
  notFound: string[];
  totalRows: number;
  error?: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".csv") || droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      setFile(droppedFile);
      setResult(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload-products", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        updated: 0,
        inserted: 0,
        errors: [{ row: 0, message: error.message }],
        notFound: [],
        totalRows: 0,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">ייבוא קובץ CSV / Excel</h1>
        <p className="text-slate-500">העלה קובץ מוצרים לעדכון או הוספה לקטלוג</p>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${
            dragActive 
              ? "border-blue-500 bg-blue-50" 
              : file 
                ? "border-green-400 bg-green-50" 
                : "border-slate-200 hover:border-slate-300 bg-slate-50"
          }`}
        >
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={loading}
          />

          {file ? (
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); resetForm(); }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                הסר קובץ
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-100 rounded-full">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg font-medium text-slate-700">
                <span className="text-blue-600">לחץ לבחירה</span> או גרור קובץ לכאן
              </p>
              <p className="text-sm text-slate-400">CSV, XLSX, XLS</p>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                מייבא... אנא המתן
              </span>
            ) : (
              "העלה והרץ עדכון"
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">מוצרים שעודכנו</p>
                  <p className="text-2xl font-bold text-slate-900">{result.updated}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">מוצרים חדשים שנוספו</p>
                  <p className="text-2xl font-bold text-slate-900">{result.inserted}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  result.errors.length > 0 ? "bg-red-100" : "bg-slate-100"
                }`}>
                  <svg className={`w-5 h-5 ${result.errors.length > 0 ? "text-red-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">שורות עם שגיאות</p>
                  <p className="text-2xl font-bold text-slate-900">{result.errors.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Total Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-slate-600">
              סה״כ עובדו <span className="font-bold text-slate-900">{result.totalRows}</span> שורות
              {result.success && result.errors.length === 0 && (
                <span className="mr-2 text-green-600">✓ הייבוא הושלם בהצלחה!</span>
              )}
            </p>
          </div>

          {/* Error Table */}
          {result.errors.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-red-50">
                <h3 className="font-medium text-red-800">שגיאות ({result.errors.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-right">
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">שורה</th>
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">שגיאה</th>
                      <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase">נתונים</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.errors.slice(0, 50).map((err, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-sm text-slate-900 font-medium">{err.row}</td>
                        <td className="px-5 py-3 text-sm text-red-600">{err.message}</td>
                        <td className="px-5 py-3 text-sm text-slate-500 font-mono text-xs">
                          {err.data ? JSON.stringify(err.data).slice(0, 100) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.errors.length > 50 && (
                  <div className="px-5 py-3 text-sm text-slate-500 bg-slate-50">
                    מציג 50 מתוך {result.errors.length} שגיאות
                  </div>
                )}
              </div>
            </div>
          )}

          {/* General Error */}
          {result.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-red-800 font-medium">שגיאה כללית</p>
              <p className="text-red-600 text-sm mt-1">{result.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="font-medium text-slate-900 mb-3">פורמט הקובץ</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>• עמודות נדרשות: <code className="bg-slate-200 px-1.5 py-0.5 rounded">modelRef</code>, <code className="bg-slate-200 px-1.5 py-0.5 rounded">color</code></p>
          <p>• עמודות אופציונליות: collection, category, subcategory, brand, gender, supplier, priceRetail, priceWholesale, stockQuantity, imageUrl, gallery, productName, size</p>
          <p>• מוצרים קיימים יעודכנו לפי התאמת modelRef + color</p>
          <p>• מוצרים חדשים יתווספו אוטומטית</p>
          <p>• שדות חסרים בקובץ לא ישנו את הערכים הקיימים</p>
        </div>
      </div>
    </div>
  );
}

