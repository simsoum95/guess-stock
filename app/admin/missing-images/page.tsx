import { fetchProducts } from "@/lib/fetchProducts";

export const dynamic = 'force-dynamic';

export default async function MissingImagesPage() {
  const products = await fetchProducts();
  
  // Filter products without images
  const missing = products.filter(p => {
    return !p.imageUrl || 
           p.imageUrl === "/images/default.png" ||
           p.imageUrl.includes("default");
  });

  // Sort by modelRef
  missing.sort((a, b) => a.modelRef.localeCompare(b.modelRef));

  const withImages = products.length - missing.length;
  const percentage = Math.round((withImages / products.length) * 100);

  return (
    <div className="p-6 lg:p-8 lg:pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">מוצרים ללא תמונה</h1>
        <p className="text-slate-500 mt-1">רשימת מוצרים שחסרה להם תמונה</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-3xl font-bold text-slate-900">{products.length}</p>
          <p className="text-sm text-slate-500">סה״כ מוצרים</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{withImages}</p>
          <p className="text-sm text-green-600">עם תמונה ({percentage}%)</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{missing.length}</p>
          <p className="text-sm text-red-600">בלי תמונה</p>
        </div>
      </div>

      {/* Simple list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="font-medium text-slate-700">מק״ט - צבע</span>
          <button 
            onClick={() => {
              const text = missing.map(p => `${p.modelRef}\t${p.color}`).join('\n');
              navigator.clipboard.writeText(text);
            }}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            העתק הכל
          </button>
        </div>
        
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-right font-medium text-slate-600">#</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">מק״ט</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">צבע</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">קטגוריה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {missing.map((p, i) => (
                <tr key={`${p.modelRef}-${p.color}-${i}`} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2 font-mono font-medium text-slate-900">{p.modelRef}</td>
                  <td className="px-4 py-2 text-slate-600">{p.color}</td>
                  <td className="px-4 py-2 text-slate-500">{p.subcategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Copy helper */}
      <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <p className="text-sm text-blue-800 font-medium mb-2">💡 לייצוא לאקסל:</p>
        <p className="text-sm text-blue-700">
          1. סמן את כל הטבלה (Ctrl+A בתוך הטבלה)<br/>
          2. העתק (Ctrl+C)<br/>
          3. הדבק באקסל (Ctrl+V)
        </p>
      </div>
    </div>
  );
}

