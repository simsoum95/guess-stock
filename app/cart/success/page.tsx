"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import jsPDF from "jspdf";

interface OrderItem {
  name: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderDetails {
  shopName: string;
  firstName: string;
  phone: string;
  salespersonName: string;
  items: OrderItem[];
  totalPrice: number;
  date: string;
}

export default function SuccessPage() {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lastOrder");
    if (saved) {
      setOrderDetails(JSON.parse(saved));
    }
  }, []);

  const downloadPDF = async () => {
    if (!orderDetails) return;
    
    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;
      let y = 20;

      // Title
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("בקשת הצעת מחיר", pageWidth / 2, y, { align: "center" });
      y += 15;

      // Customer info
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      
      const infoLines = [
        `שם החנות: ${orderDetails.shopName}`,
        `שם פרטי: ${orderDetails.firstName}`,
      ];
      if (orderDetails.phone) infoLines.push(`טלפון: ${orderDetails.phone}`);
      if (orderDetails.salespersonName) infoLines.push(`שם הסוכן: ${orderDetails.salespersonName}`);
      infoLines.push(`תאריך: ${orderDetails.date}`);

      infoLines.forEach(line => {
        pdf.text(line, pageWidth - margin, y, { align: "right" });
        y += 7;
      });
      y += 10;

      // Table header
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y, contentWidth, 10, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      
      pdf.text("מוצר", pageWidth - margin - 5, y + 7, { align: "right" });
      pdf.text("כמות", pageWidth - margin - 70, y + 7, { align: "center" });
      pdf.text("מחיר יחידה", pageWidth - margin - 100, y + 7, { align: "center" });
      pdf.text('סה"כ', margin + 20, y + 7, { align: "center" });
      y += 12;

      // Table rows
      pdf.setFont("helvetica", "normal");
      orderDetails.items.forEach((item) => {
        pdf.text(item.name, pageWidth - margin - 5, y + 5, { align: "right" });
        if (item.detail) {
          pdf.setFontSize(8);
          pdf.setTextColor(100);
          pdf.text(item.detail, pageWidth - margin - 5, y + 10, { align: "right" });
          pdf.setFontSize(10);
          pdf.setTextColor(0);
        }
        pdf.text(item.quantity.toString(), pageWidth - margin - 70, y + 5, { align: "center" });
        pdf.text(`₪${item.unitPrice.toFixed(2)}`, pageWidth - margin - 100, y + 5, { align: "center" });
        pdf.text(`₪${item.totalPrice.toFixed(2)}`, margin + 20, y + 5, { align: "center" });
        
        // Line separator
        pdf.setDrawColor(220);
        pdf.line(margin, y + 14, pageWidth - margin, y + 14);
        y += 16;
      });

      // Total
      y += 5;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(`סה"כ כולל: ₪${orderDetails.totalPrice.toFixed(2)}`, pageWidth - margin, y, { align: "right" });

      // Footer
      y += 20;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text("הבקשה תועבר ליועץ המכירות שלך שיחזור אליך בהקדם", pageWidth / 2, y, { align: "center" });

      pdf.save(`בקשת_הצעת_מחיר_${orderDetails.shopName}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("שגיאה ביצירת ה-PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-luxury-white flex items-center justify-center">
      <section className="mx-auto max-w-[500px] px-4 py-10 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-light text-luxury-noir mb-4">הבקשה נשלחה בהצלחה!</h1>
        
        <p className="text-lg text-luxury-grey mb-2">
          תודה על פנייתך
        </p>
        
        <p className="text-base text-luxury-grey mb-8">
          היועץ שלך יחזור אליך בהקדם האפשרי
        </p>

        <div className="space-y-3">
          {orderDetails && (
            <button
              onClick={downloadPDF}
              disabled={isGenerating}
              className="w-full px-8 py-4 bg-white border-2 border-black text-black text-base font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {isGenerating ? "יוצר PDF..." : "📄 הורד את ההזמנה שלי (PDF)"}
            </button>
          )}
          
          <Link
            href="/products"
            className="block w-full px-8 py-4 bg-black text-white text-base font-medium rounded-lg"
          >
            חזרה לקטלוג
          </Link>
        </div>
      </section>
    </main>
  );
}
