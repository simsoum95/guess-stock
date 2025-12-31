import { fetchProducts } from "@/lib/fetchProducts";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// Cache for 2 minutes - faster navigation, data refreshed every 2 min
export const revalidate = 120;

async function getStats() {
  try {
    const products = await fetchProducts();

    const total = products.length;
    const withImages = products.filter(p => p.imageUrl && !p.imageUrl.includes("default")).length;
    
    const byCategory: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.subcategory || "אחר";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    // Get unread pending cart requests count (only pending, not done)
    const { count: unreadCount } = await supabase
      .from("cart_exports")
      .select("*", { count: "exact", head: true })
      .eq("viewed", false)
      .eq("status", "pending");

    return { total, withImages, byCategory, unreadCount: unreadCount || 0 };
  } catch (error) {
    console.error("[AdminDashboard] Error fetching stats:", error);
    return null;
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();

  if (!stats) {
    return (
      <div className="p-6 lg:p-8 lg:pt-8 pt-20 text-center">
        <p className="text-slate-500">שגיאה בטעינת נתונים</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 lg:pt-8 pt-20">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">לוח בקרה</h1>
        <p className="text-slate-500 mt-1">סקירה כללית של הקטלוג</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="סה״כ מוצרים" value={stats.total} color="blue" />
        <StatCard title="מוצרים עם תמונה" value={stats.withImages} color="purple" />
        <StatCard 
          title="בקשות הצעת מחיר" 
          value={stats.unreadCount} 
          color="amber" 
          link="/admin/orders"
          hasBadge={stats.unreadCount > 0}
        />
      </div>

      {/* Alerts */}
      {stats.total - stats.withImages > 0 && (
        <div className="mb-8">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900">תמונות חסרות</p>
              <p className="text-sm text-slate-600">{stats.total - stats.withImages} מוצרים ללא תמונה</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions & Categories */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">פעולות מהירות</h2>
          <div className="space-y-2">
            <Link
              href="/admin/products"
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">צפה בכל המוצרים</p>
                <p className="text-xs text-slate-500">{stats.total} מוצרים בקטלוג</p>
              </div>
            </Link>
            
            <Link
              href="/admin/products/new"
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">הוסף מוצר חדש</p>
                <p className="text-xs text-slate-500">יצירת פריט חדש בקטלוג</p>
              </div>
            </Link>

            <Link
              href="/products"
              target="_blank"
              className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">צפה באתר</p>
                <p className="text-xs text-slate-500">פתח את הקטלוג הציבורי</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">לפי קטגוריה</h2>
          <div className="space-y-3">
            {Object.entries(stats.byCategory).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-slate-600">{category}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-900 w-10 text-left">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  color, 
  link,
  hasBadge 
}: { 
  title: string; 
  value: string | number; 
  color: string;
  link?: string;
  hasBadge?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };

  const cardContent = (
    <div className="bg-white rounded-xl border border-slate-200 p-5 relative">
      {hasBadge && (
        <div className="absolute top-3 left-3 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      )}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        {link ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{title}</p>
    </div>
  );

  if (link) {
    return (
      <Link href={link} className="block hover:opacity-80 transition-opacity">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
