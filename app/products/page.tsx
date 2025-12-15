import { fetchProducts } from "@/lib/fetchProducts";
import ProductsClient from "./ProductsClient";

// Cache for 60 seconds - good balance between speed and freshness
export const revalidate = 30;

export default async function ProductsPage() {
  try {
    const products = await fetchProducts();
    return <ProductsClient products={products} />;
  } catch (error) {
    console.error("[ProductsPage] Error:", error);
    return (
      <div className="min-h-screen bg-luxury-white flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-4">שגיאה בטעינת המוצרים</h1>
          <p className="text-slate-700 mb-4">
            לא ניתן לטעון את המוצרים מהגיליון האלקטרוני.
          </p>
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <p className="text-sm text-red-800 font-mono">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
          <div className="text-sm text-slate-600 space-y-2">
            <p>אפשרויות לפתרון:</p>
            <ul className="list-disc list-inside space-y-1 mr-4">
              <li>ודא שהגיליון האלקטרוני (Google Sheet) פומבי: <strong>Share → "Anyone with the link" → "Viewer"</strong></li>
              <li>
                <strong>En production (Vercel):</strong> ודא שהמשתנה GOOGLE_SHEET_ID מוגדר ב-Vercel Settings → Environment Variables
              </li>
              <li>
                <strong>En local:</strong> ודא שהמשתנה GOOGLE_SHEET_ID מוגדר ב-.env.local
              </li>
              <li>נסה לרענן את העמוד</li>
              <li>בדוק את ה-logs של Vercel pour plus de détails</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
}

