"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UpdatedProduct {
  id: string;
  modelRef: string;
  color: string;
  size: string;
  oldStock: number;
  newStock: number;
  matchType: string;
  confidence: number;
  rowNumber: number;
}

interface CreatedProduct {
  id: string;
  modelRef: string;
  color: string;
  size: string;
  stock: number;
  rowNumber: number;
}

interface NotFoundProduct {
  row: number;
  data: {
    reference?: string;
    color?: string;
    size?: string;
    stock?: number;
  };
  reason: string;
  suggestions: string[];
}

interface UploadError {
  row: number;
  message: string;
}

interface UploadReport {
  updated: UpdatedProduct[];
  created: CreatedProduct[];
  notFound: NotFoundProduct[];
  errors: UploadError[];
  duplicates: Array<{
    rowNumbers: number[];
    modelRef: string;
    color: string;
    size: string;
  }>;
}

interface UploadResponse {
  success: boolean;
  dryRun?: boolean;
  summary?: {
    totalRows: number;
    validRows: number;
    toUpdate: number;
    toCreate: number;
    notFound: number;
    errors: number;
    duplicatesInFile: number;
  };
  report?: UploadReport;
  message?: string;
  error?: string;
  details?: string;
  backupPath?: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dryRunMode, setDryRunMode] = useState(true);
  const [response, setResponse] = useState<UploadResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"updated" | "created" | "notFound" | "errors">("updated");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      router.push("/admin/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile);
      setResponse(null);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile);
      setResponse(null);
    }
  }, []);

  const isValidFile = (file: File): boolean => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    return validExtensions.includes(extension);
  };

  const handleUpload = async (isDryRun: boolean) => {
    if (!file) return;

    setIsUploading(true);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dryRun", isDryRun.toString());

      const res = await fetch("/api/admin/upload-products", {
        method: "POST",
        body: formData,
      });

      const data: UploadResponse = await res.json();
      setResponse(data);
      
      if (data.success && !isDryRun) {
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      setResponse({
        success: false,
        error: "שגיאת חיבור לשרת",
        details: error instanceof Error ? error.message : "שגיאה לא ידועה",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = async (format: "csv" | "xlsx") => {
    try {
      const res = await fetch(`/api/admin/upload-products?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template-stock.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("שגיאה בהורדת תבנית:", error);
    }
  };

  const getMatchTypeLabel = (matchType: string): string => {
    switch (matchType) {
      case "id":
        return "מזהה מדויק";
      case "modelRef+color+size":
        return "מק״ט + צבע + מידה";
      case "modelRef+color":
        return "מק״ט + צבע";
      case "modelRef":
        return "מק״ט בלבד";
      default:
        return matchType;
    }
  };

  const getMatchTypeColor = (matchType: string): string => {
    switch (matchType) {
      case "id":
        return "bg-emerald-100 text-emerald-800";
      case "modelRef+color+size":
        return "bg-blue-100 text-blue-800";
      case "modelRef+color":
        return "bg-amber-100 text-amber-800";
      case "modelRef":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href="/admin/products" 
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2 mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                חזרה למוצרים
              </Link>
              <h1 className="text-2xl font-semibold text-gray-900">
                העלאת קובץ Excel / CSV
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                עדכון מלאי ויצירת מוצרים חדשים
              </p>
            </div>
            
            {/* Download Templates & Logout */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadTemplate("csv")}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                תבנית CSV
              </button>
              <button
                onClick={() => downloadTemplate("xlsx")}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                תבנית Excel
              </button>
              <div className="w-px h-8 bg-gray-300 mx-2" />
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                התנתק
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Instructions */}
        <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            איך זה עובד
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>עמודות חובה:</strong> לפחות <code className="bg-blue-100 px-1.5 py-0.5 rounded">modelRef</code> (או <code className="bg-blue-100 px-1.5 py-0.5 rounded">reference</code>) ו-<code className="bg-blue-100 px-1.5 py-0.5 rounded">stockQuantity</code> (או <code className="bg-blue-100 px-1.5 py-0.5 rounded">stock</code>)</p>
            <p><strong>עמודות אופציונליות:</strong> <code className="bg-blue-100 px-1.5 py-0.5 rounded">id</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">color</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">size</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">collection</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">category</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">brand</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">priceRetail</code>, <code className="bg-blue-100 px-1.5 py-0.5 rounded">priceWholesale</code></p>
            <div className="mt-3 p-3 bg-blue-100 rounded-lg">
              <p className="font-medium mb-1">מערכת התאמה חכמה:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li><strong>מזהה מדויק (ID)</strong> - אם יש ID, זה הקריטריון העדיף (100%)</li>
                <li><strong>מק״ט + צבע + מידה</strong> - התאמה הכי מדויקת (95%)</li>
                <li><strong>מק״ט + צבע</strong> - אם יש רק מוצר אחד תואם (85%)</li>
                <li><strong>מק״ט בלבד</strong> - רק אם יש מוצר אחד עם המק״ט הזה (70%)</li>
              </ol>
            </div>
            <div className="mt-3 p-3 bg-emerald-100 rounded-lg border border-emerald-200">
              <p className="font-medium text-emerald-800 mb-1">יצירת מוצרים חדשים:</p>
              <p className="text-emerald-700">אם מוצר לא קיים במערכת (מק״ט חדש), הוא יווצר אוטומטית עם כל הנתונים שסופקו.</p>
            </div>
            <p className="mt-2 text-blue-600">
              <strong>⚠️ חשוב:</strong> אם יש כמה מוצרים עם אותו מק״ט, חובה לציין צבע (ו/או מידה) כדי למנוע שגיאות.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="mb-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDragging 
                ? "border-blue-500 bg-blue-50" 
                : file 
                  ? "border-emerald-500 bg-emerald-50" 
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {file ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setResponse(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-4 text-sm text-red-600 hover:text-red-700"
                >
                  הסר קובץ
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-700">
                  גרור ושחרר את הקובץ כאן
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  או לחץ לבחירת קובץ
                </p>
                <p className="text-xs text-gray-400 mt-3">
                  פורמטים נתמכים: .xlsx, .xls, .csv
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mode Selection & Upload Buttons */}
        {file && (
          <div className="mb-8 space-y-4">
            {/* Dry Run Toggle */}
            <div className="flex items-center justify-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRunMode}
                  onChange={(e) => setDryRunMode(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">מצב תצוגה מקדימה (בדיקה ללא שינויים)</span>
              </label>
            </div>

            {/* Upload Buttons */}
            <div className="flex justify-center gap-4">
              {dryRunMode ? (
                <button
                  onClick={() => handleUpload(true)}
                  disabled={isUploading}
                  className={`
                    px-8 py-3 rounded-lg font-medium text-white transition-all duration-200
                    ${isUploading 
                      ? "bg-gray-400 cursor-not-allowed" 
                      : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
                    }
                  `}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      בודק...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      תצוגה מקדימה
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => handleUpload(false)}
                  disabled={isUploading}
                  className={`
                    px-8 py-3 rounded-lg font-medium text-white transition-all duration-200
                    ${isUploading 
                      ? "bg-gray-400 cursor-not-allowed" 
                      : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]"
                    }
                  `}
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      מעבד...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      העלה ועדכן
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Warning for non-dry-run mode */}
            {!dryRunMode && (
              <div className="flex justify-center">
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>פעולה זו תשנה את הנתונים. גיבוי אוטומטי יישמר לפני השינוי.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className={`p-6 rounded-xl border ${response.success ? (response.dryRun ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200") : "bg-red-50 border-red-200"}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${response.success ? (response.dryRun ? "bg-blue-100" : "bg-emerald-100") : "bg-red-100"}`}>
                  {response.success ? (
                    response.dryRun ? (
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )
                  ) : (
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${response.success ? (response.dryRun ? "text-blue-900" : "text-emerald-900") : "text-red-900"}`}>
                    {response.success 
                      ? (response.dryRun ? "תצוגה מקדימה" : "העלאה הצליחה!") 
                      : "שגיאה בהעלאה"}
                  </h3>
                  <p className={`mt-1 ${response.success ? (response.dryRun ? "text-blue-700" : "text-emerald-700") : "text-red-700"}`}>
                    {response.message || response.error}
                  </p>
                  {response.details && (
                    <p className="mt-1 text-sm text-red-600">{response.details}</p>
                  )}
                  {response.dryRun && response.success && (
                    <button
                      onClick={() => {
                        setDryRunMode(false);
                        handleUpload(false);
                      }}
                      className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                      אישור והפעלה
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              {response.summary && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <p className="text-2xl font-bold text-gray-900">{response.summary.totalRows}</p>
                    <p className="text-sm text-gray-500">שורות בקובץ</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-emerald-200">
                    <p className="text-2xl font-bold text-emerald-600">{response.summary.toUpdate}</p>
                    <p className="text-sm text-gray-500">{response.dryRun ? "יעודכנו" : "עודכנו"}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <p className="text-2xl font-bold text-blue-600">{response.summary.toCreate}</p>
                    <p className="text-sm text-gray-500">{response.dryRun ? "ייווצרו" : "נוצרו"}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-amber-200">
                    <p className="text-2xl font-bold text-amber-600">{response.summary.notFound}</p>
                    <p className="text-sm text-gray-500">עמימות</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-red-200">
                    <p className="text-2xl font-bold text-red-600">{response.summary.errors}</p>
                    <p className="text-sm text-gray-500">שגיאות</p>
                  </div>
                </div>
              )}
            </div>

            {/* Detailed Report */}
            {response.report && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <div className="flex flex-wrap">
                    <button
                      onClick={() => setActiveTab("updated")}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === "updated"
                          ? "text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      עודכנו ({response.report.updated.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("created")}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === "created"
                          ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      נוצרו ({response.report.created.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("notFound")}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === "notFound"
                          ? "text-amber-600 border-b-2 border-amber-600 bg-amber-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      עמימות ({response.report.notFound.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("errors")}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === "errors"
                          ? "text-red-600 border-b-2 border-red-600 bg-red-50"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      שגיאות ({response.report.errors.length})
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="max-h-[500px] overflow-y-auto">
                  {activeTab === "updated" && (
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">שורה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מזהה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מק״ט</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">צבע</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מידה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מלאי קודם</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מלאי חדש</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">סוג התאמה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {response.report.updated.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-500">{item.rowNumber}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-mono">{item.id}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.modelRef}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.color || "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.size || "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.oldStock}</td>
                            <td className="px-4 py-3 text-sm font-medium">
                              <span className={item.newStock > item.oldStock ? "text-emerald-600" : item.newStock < item.oldStock ? "text-red-600" : "text-gray-600"}>
                                {item.newStock}
                                {item.newStock !== item.oldStock && (
                                  <span className="text-xs mr-1">
                                    ({item.newStock > item.oldStock ? "+" : ""}{item.newStock - item.oldStock})
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getMatchTypeColor(item.matchType)}`}>
                                {getMatchTypeLabel(item.matchType)}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {response.report.updated.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              לא עודכנו מוצרים
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {activeTab === "created" && (
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">שורה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מזהה חדש</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מק״ט</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">צבע</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מידה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מלאי</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {response.report.created.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 bg-blue-50/30">
                            <td className="px-4 py-3 text-sm text-gray-500">{item.rowNumber}</td>
                            <td className="px-4 py-3 text-sm text-blue-700 font-mono font-medium">{item.id}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.modelRef}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.color || "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.size || "-"}</td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">{item.stock}</td>
                          </tr>
                        ))}
                        {response.report.created.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              לא נוצרו מוצרים חדשים
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {activeTab === "notFound" && (
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">שורה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מק״ט</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">צבע</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מידה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">מלאי</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">סיבה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {response.report.notFound.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{item.row}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.data.reference || "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.data.color || "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.data.size || "-"}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.data.stock ?? "-"}</td>
                            <td className="px-4 py-3 text-sm text-amber-700">
                              <div>{item.reason}</div>
                              {item.suggestions && item.suggestions.length > 0 && (
                                <div className="mt-1 text-xs text-gray-500">
                                  {item.suggestions.map((s, i) => (
                                    <div key={i}>{s}</div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {response.report.notFound.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              כל המוצרים זוהו
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {activeTab === "errors" && (
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">שורה</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">שגיאה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {response.report.errors.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{item.row}</td>
                            <td className="px-4 py-3 text-sm text-red-700">{item.message}</td>
                          </tr>
                        ))}
                        {response.report.errors.length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                              אין שגיאות
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
