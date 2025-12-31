"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CartItem {
  productName: string;
  itemCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  shop_name: string;
  first_name: string;
  phone: string | null;
  items: CartItem[];
  total_price: number;
  created_at: string;
  ip_address: string | null;
  viewed: boolean;
  status?: string;
}

export function OrdersTable({ orders, status = "pending" }: { orders: Order[]; status?: string }) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [viewedOrders, setViewedOrders] = useState<Set<string>>(new Set());
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const router = useRouter();

  const handleViewDetails = async (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
    
    // Mark as viewed when details are expanded
    if (expandedOrder !== orderId && !viewedOrders.has(orderId)) {
      try {
        const response = await fetch("/api/cart/mark-viewed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        
        if (response.ok) {
          setViewedOrders(prev => new Set(prev).add(orderId));
          router.refresh();
        }
      } catch (error) {
        console.error("Error marking as viewed:", error);
      }
    }
  };

  const handleMarkDone = async (orderId: string) => {
    setProcessingOrder(orderId);
    try {
      const response = await fetch("/api/cart/mark-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      
      if (response.ok) {
        router.refresh();
      } else {
        alert("שגיאה בסימון הבקשה כבוצעה");
      }
    } catch (error) {
      console.error("Error marking as done:", error);
      alert("שגיאה בסימון הבקשה כבוצעה");
    } finally {
      setProcessingOrder(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500">אין בקשות עדיין</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                תאריך
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                שם החנות
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                שם פרטי
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                טלפון
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                פריטים
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                סה"כ
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                פעולות
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {orders.map((order) => {
              const date = new Date(order.created_at).toLocaleDateString("he-IL", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

              const isViewed = viewedOrders.has(order.id) || order.viewed;
              const isPending = status === "pending";

              return (
                <>
                  <tr key={order.id} className={`hover:bg-slate-50 ${!isViewed && isPending ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      <div className="flex items-center gap-2">
                        {!isViewed && isPending && (
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                        )}
                        {date}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {order.shop_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {order.first_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {order.phone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {totalItems}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      ₪{Number(order.total_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleViewDetails(order.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {expandedOrder === order.id ? "הסתר" : "פרטים"}
                        </button>
                        {isPending && (
                          <button
                            onClick={() => handleMarkDone(order.id)}
                            disabled={processingOrder === order.id}
                            className="text-green-600 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingOrder === order.id ? "..." : "בוצע"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedOrder === order.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-slate-50">
                        <div className="space-y-2">
                          <h4 className="font-medium text-slate-900 mb-3">פרטי המוצרים:</h4>
                          {order.items.map((item, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0"
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-slate-500">{item.itemCode}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-900">
                                  כמות: {item.quantity} × ₪{item.unitPrice.toFixed(2)}
                                </p>
                                <p className="text-sm font-medium text-slate-900">
                                  סה"כ: ₪{item.totalPrice.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

