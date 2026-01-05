"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface CartItem {
  productName: string;
  itemCode: string;
  category?: string;
  color?: string;
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

  const handleDownloadExcel = (order: Order) => {
    try {
      // Prepare data for Excel export
      const date = new Date(order.created_at).toLocaleDateString("he-IL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Header row with order info
      const headerData = [
        ["פרטי הלקוח"],
        ["תאריך", date],
        ["שם החנות", order.shop_name],
        ["שם פרטי", order.first_name],
        ["טלפון", order.phone || ""],
        [],
        ["פרטי המוצרים"],
        ["שם מוצר", "קוד פריט", "כמות", "מחיר יחידה (₪)", "סה\"כ (₪)"],
      ];

      // Product rows
      const productRows = order.items.map((item) => [
        item.productName,
        item.itemCode,
        item.quantity,
        item.unitPrice.toFixed(2),
        item.totalPrice.toFixed(2),
      ]);

      // Total row
      const totalRow = ["", "", "", "סה\"כ כולל:", order.total_price.toFixed(2)];

      // Combine all data
      const excelData = [
        ...headerData,
        ...productRows,
        [],
        totalRow,
      ];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths for better readability
      ws["!cols"] = [
        { wch: 30 }, // שם מוצר
        { wch: 20 }, // קוד פריט
        { wch: 10 }, // כמות
        { wch: 15 }, // מחיר יחידה
        { wch: 15 }, // סה"כ
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "בקשת הצעת מחיר");

      // Generate filename
      const filename = `בקשת_הצעת_מחיר_${order.shop_name}_${order.first_name}_${date.replace(/[\/\s:]/g, "_")}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error generating Excel:", error);
      alert(`שגיאה ביצירת הקובץ: ${error instanceof Error ? error.message : String(error)}`);
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
                        <button
                          onClick={() => handleDownloadExcel(order)}
                          className="text-purple-600 hover:text-purple-800"
                          title="הורד קובץ Excel"
                        >
                          הורד
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
                          {order.items.map((item, index) => {
                            // For shoes: productName is modelRef, show color below
                            // For bags: productName is bagName, show itemCode below
                            const isBag = item.category === "תיק";
                            const displayDetail = isBag ? item.itemCode : item.color;
                            
                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0"
                              >
                                <div>
                                  <p className="text-sm font-bold text-slate-900">
                                    {item.productName}
                                  </p>
                                  {displayDetail && (
                                    <p className="text-xs text-slate-500">{displayDetail}</p>
                                  )}
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
                          );
                          })}
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

