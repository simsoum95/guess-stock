import { supabase } from "@/lib/supabase";
import { OrdersTable } from "./OrdersTable";
import { RefreshOnMount } from "./RefreshOnMount";

export const revalidate = 0; // Always fetch fresh data when page is accessed

async function getOrders() {
  const { data, error } = await supabase
    .from("cart_exports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[admin/orders] Error fetching orders:", error);
    return { pending: [], done: [] };
  }

  // Separate pending and done orders
  const pending = (data || []).filter(order => !order.status || order.status === "pending");
  const done = (data || []).filter(order => order.status === "done");

  return { pending, done };
}

export default async function AdminOrdersPage() {
  const { pending, done } = await getOrders();

  return (
    <div className="p-6 lg:p-8 lg:pt-8 pt-20">
      <RefreshOnMount />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">בקשות הצעת מחיר</h1>
        <p className="text-slate-500 mt-1">כל הבקשות שנשלחו על ידי הלקוחות</p>
      </div>

      {/* Pending Orders */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">ממתין</h2>
        <OrdersTable orders={pending} status="pending" />
      </div>

      {/* Done Orders */}
      {done.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">בוצע</h2>
          <OrdersTable orders={done} status="done" />
        </div>
      )}
    </div>
  );
}

