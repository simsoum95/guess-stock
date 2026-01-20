"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lastOrder");
    if (saved) {
      setOrderDetails(JSON.parse(saved));
    }
  }, []);

  const downloadPDF = async () => {
    if (!orderDetails || !pdfRef.current) return;
    
    setIsGenerating(true);
    
    try {
      const element = pdfRef.current;
      
      // Make visible for capture
      element.style.position = "fixed";
      element.style.left = "0";
      element.style.top = "0";
      element.style.zIndex = "9999";
      element.style.opacity = "1";
      element.style.visibility = "visible";
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      
      // Hide again
      element.style.position = "absolute";
      element.style.left = "-9999px";
      element.style.opacity = "0";
      element.style.visibility = "hidden";
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
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
      {/* Hidden PDF Template */}
      {orderDetails && (
        <div 
          ref={pdfRef}
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "210mm",
            backgroundColor: "white",
            opacity: 0,
            visibility: "hidden",
          }}
          dir="rtl"
        >
          <div style={{ 
            padding: "40px", 
            fontFamily: "Arial, 'Noto Sans Hebrew', sans-serif",
            color: "#111",
          }}>
            <h1 style={{ 
              fontSize: "28px", 
              fontWeight: "bold", 
              textAlign: "center", 
              marginBottom: "30px",
              borderBottom: "2px solid #111",
              paddingBottom: "15px",
            }}>
              בקשת הצעת מחיר
            </h1>
            
            <div style={{ marginBottom: "25px", fontSize: "14px", lineHeight: "1.8" }}>
              <p><strong>שם החנות:</strong> {orderDetails.shopName}</p>
              <p><strong>שם פרטי:</strong> {orderDetails.firstName}</p>
              {orderDetails.phone && <p><strong>טלפון:</strong> {orderDetails.phone}</p>}
              {orderDetails.salespersonName && <p><strong>שם הסוכן:</strong> {orderDetails.salespersonName}</p>}
              <p><strong>תאריך:</strong> {orderDetails.date}</p>
            </div>

            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse", 
              marginBottom: "25px",
              fontSize: "13px",
            }}>
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th style={{ border: "1px solid #ddd", padding: "12px", textAlign: "right" }}>מוצר</th>
                  <th style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center" }}>כמות</th>
                  <th style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center" }}>מחיר יחידה</th>
                  <th style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center" }}>סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {orderDetails.items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ border: "1px solid #ddd", padding: "12px" }}>
                      <div style={{ fontWeight: "bold" }}>{item.name}</div>
                      {item.detail && <div style={{ fontSize: "11px", color: "#666" }}>{item.detail}</div>}
                    </td>
                    <td style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center" }}>{item.quantity}</td>
                    <td style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center" }}>₪{item.unitPrice.toFixed(2)}</td>
                    <td style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center" }}>₪{item.totalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ 
              textAlign: "left", 
              fontSize: "18px", 
              fontWeight: "bold",
              borderTop: "2px solid #111",
              paddingTop: "15px",
              marginBottom: "30px",
            }}>
              סה״כ כולל: ₪{orderDetails.totalPrice.toFixed(2)}
            </div>

            <div style={{ 
              textAlign: "center", 
              fontSize: "12px", 
              color: "#666",
              marginTop: "40px",
            }}>
              הבקשה תועבר ליועץ המכירות שלך שיחזור אליך בהקדם
            </div>
          </div>
        </div>
      )}

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
