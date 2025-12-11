"use client";

import { useState, useCallback } from "react";

interface ChangeDetail {
  modelRef: string;
  color: string;
  field: string;
  oldValue: any;
  newValue: any;
}

interface UploadResult {
  success: boolean;
  updated: number;
  inserted: number;
  unchanged: number;
  stockZeroed?: number;
  errors: Array<{ row: number; message: string }>;
  insertedProducts?: Array<{ modelRef: string; color: string }>;
  zeroedProducts?: Array<{ modelRef: string; color: string; oldStock: number }>;
  changes: ChangeDetail[];
  totalRows: number;
  detectedColumns?: string[];
  sheets?: string[];
  error?: string;
  syncStockEnabled?: boolean;
  updatePricesEnabled?: boolean;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [syncStock, setSyncStock] = useState(false);
  const [updatePrices, setUpdatePrices] = useState(false);

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
      formData.append("syncStock", syncStock.toString());
      formData.append("updatePrices", updatePrices.toString());

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
        unchanged: 0,
        errors: [{ row: 0, message: error.message }],
        changes: [],
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
        <h1 className="text-2xl font-bold text-slate-900 mb-2">ייבוא קובץ Excel / CSV</h1>
        <p className="text-slate-500">עדכון מלאי ומחירים מקובץ</p>
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
              <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
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
              <p className="text-sm text-slate-400">Excel (XLSX, XLS) או CSV</p>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="mt-6 space-y-4">
          {/* Option prix */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={updatePrices}
                onChange={(e) => setUpdatePrices(e.target.checked)}
                className="mt-1 w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                disabled={loading}
              />
              <div>
                <p className="font-medium text-blue-800">עדכון מחירים</p>
                <p className="text-sm text-blue-700 mt-1">
                  עדכן גם מחיר קמעונאי ומחיר סיטונאי (אם קיימים בקובץ)
                </p>
              </div>
            </label>
          </div>

          {/* Option sync stock */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={syncStock}
                onChange={(e) => setSyncStock(e.target.checked)}
                className="mt-1 w-5 h-5 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                disabled={loading}
              />
              <div>
                <p className="font-medium text-amber-800">סנכרון מלאי</p>
                <p className="text-sm text-amber-700 mt-1">
                  מוצרים שלא מופיעים בקובץ יעברו אוטומטית למלאי 0
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ השתמש באפשרות זו רק אם הקובץ מכיל את כל המוצרים שלך
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                מעבד קובץ...
              </span>
            ) : (
              "העלה ועדכן"
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Error Message */}
          {result.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-medium text-red-800">❌ שגיאה</p>
              <p className="text-sm text-red-600 mt-1">{result.error}</p>
            </div>
          )}

          {/* Summary Cards */}
          {result.success && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">עודכנו</p>
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">חדשים</p>
                  <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">ללא שינוי</p>
                  <p className="text-2xl font-bold text-slate-600">{result.unchanged}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">שגיאות</p>
                  <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                </div>
              </div>

              {/* Stock zeroed */}
              {result.syncStockEnabled && (result.stockZeroed || 0) > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="font-medium text-orange-800">📦 מוצרים שעברו למלאי 0: {result.stockZeroed}</p>
                </div>
              )}

              {/* Inserted Products */}
              {result.insertedProducts && result.insertedProducts.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 bg-green-50">
                    <h3 className="font-medium text-green-800">✅ מוצרים חדשים שנוספו ({result.insertedProducts.length})</h3>
                  </div>
                  <div className="overflow-x-auto max-h-40">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr className="text-right">
                          <th className="px-4 py-2 text-xs font-medium text-slate-500">מק״ט</th>
                          <th className="px-4 py-2 text-xs font-medium text-slate-500">צבע</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.insertedProducts.slice(0, 20).map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm font-mono">{item.modelRef}</td>
                            <td className="px-4 py-2 text-sm text-slate-600">{item.color}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Changes Table */}
              {result.changes && result.changes.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 bg-blue-50">
                    <h3 className="font-medium text-blue-800">✏️ שינויים ({result.changes.length})</h3>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="text-right">
                          <th className="px-4 py-3 text-xs font-medium text-slate-500">מק״ט</th>
                          <th className="px-4 py-3 text-xs font-medium text-slate-500">צבע</th>
                          <th className="px-4 py-3 text-xs font-medium text-slate-500">שדה</th>
                          <th className="px-4 py-3 text-xs font-medium text-slate-500">קודם</th>
                          <th className="px-4 py-3 text-xs font-medium text-slate-500">חדש</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.changes.slice(0, 50).map((change, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-sm font-mono text-slate-900">{change.modelRef}</td>
                            <td className="px-4 py-2 text-sm text-slate-600">{change.color}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{change.field}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{change.oldValue}</td>
                            <td className="px-4 py-2 text-sm text-green-600 font-medium">{change.newValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.changes.length > 50 && (
                      <div className="px-4 py-2 text-sm text-slate-500 bg-slate-50">
                        + עוד {result.changes.length - 50} שינויים
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-red-200 bg-red-50">
                    <h3 className="font-medium text-red-800">❌ שגיאות ({result.errors.length})</h3>
                  </div>
                  <div className="overflow-x-auto max-h-40">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr className="text-right">
                          <th className="px-4 py-2 text-xs font-medium text-slate-500">שורה</th>
                          <th className="px-4 py-2 text-xs font-medium text-slate-500">שגיאה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.errors.slice(0, 20).map((err, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm">{err.row}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Success */}
              {result.errors.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-800 font-medium">✅ הייבוא הושלם בהצלחה!</p>
                </div>
              )}

              {/* Sheets info */}
              {result.sheets && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">גליונות:</span> {result.sheets.join(" | ")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="font-medium text-slate-900 mb-3">📋 איך זה עובד</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>• <strong>עמודות נדרשות:</strong> modelRef, color</p>
          <p>• <strong>עמודה מלאי:</strong> stockQuantity (או stock)</p>
          <p>• <strong>עמודות מחיר:</strong> priceRetail, priceWholesale</p>
          <p>• מוצר חדש (לא קיים בקטלוג) → <strong>יתווסף אוטומטית</strong></p>
          <p>• מוצר קיים → <strong>יתעדכן רק אם יש שינוי</strong></p>
          <p>• סנכרון מלאי → מוצרים לא בקובץ <strong>יעברו למלאי 0</strong></p>
        </div>
      </div>
    </div>
  );
}
