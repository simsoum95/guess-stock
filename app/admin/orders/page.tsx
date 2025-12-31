import { supabase } from "@/lib/supabase";
import { OrdersTable } from "./OrdersTable";

export const revalidate = 60; // Revalidate every minute

async function getOrders() {
  const { data, error } = await supabase
    .from("cart_exports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[admin/orders] Error fetching orders:", error);
    return [];
  }

  // Mark all unread orders as viewed when page loads
  if (data && data.length > 0) {
    const unreadIds = data.filter(order => !order.viewed).map(order => order.id);
    if (unreadIds.length > 0) {
      await supabase
        .from("cart_exports")
        .update({ viewed: true })
        .in("id", unreadIds);
    }
  }

  return data || [];
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  return (
    <div className="p-6 lg:p-8 lg:pt-8 pt-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">בקשות הצעת מחיר</h1>
        <p className="text-slate-500 mt-1">כל הבקשות שנשלחו על ידי הלקוחות</p>
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}

