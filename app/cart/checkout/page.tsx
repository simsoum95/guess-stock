"use client";

import { useState, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart, getTotalPrice } = useCart();
  const [formData, setFormData] = useState({
    shopName: "",
    firstName: "",
    phone: "",
    salespersonName: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const totalPrice = getTotalPrice();

  const handleExport = async () => {
    if (!formData.shopName.trim() || !formData.firstName.trim()) {
      alert("אנא מלא את כל השדות הנדרשים");
      return;
    }

    if (!pdfRef.current) {
      alert("שגיאה ביצירת הקובץ. נסה שוב.");
      return;
    }

    setIsSubmitting(true);

    try {
      const element = pdfRef.current;
      
      const originalStyles = {
        position: element.style.position,
        left: element.style.left,
        top: element.style.top,
        width: element.style.width,
        zIndex: element.style.zIndex,
        opacity: element.style.opacity,
        visibility: element.style.visibility,
        backgroundColor: element.style.backgroundColor,
      };

      element.style.position = "fixed";
      element.style.left = "0";
      element.style.top = "0";
      element.style.width = "210mm";
      element.style.zIndex = "9999";
      element.style.opacity = "1";
      element.style.visibility = "visible";
      element.style.backgroundColor = "white";

      element.offsetHeight;
      await new Promise(resolve => setTimeout(resolve, 300));

      const width = element.scrollWidth || element.offsetWidth;
      const height = element.scrollHeight || element.offsetHeight;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: width,
        height: height,
      });

      element.style.position = originalStyles.position;
      element.style.left = originalStyles.left;
      element.style.top = originalStyles.top;
      element.style.width = originalStyles.width;
      element.style.zIndex = originalStyles.zIndex;
      element.style.opacity = originalStyles.opacity;
      element.style.visibility = originalStyles.visibility;
      element.style.backgroundColor = originalStyles.backgroundColor;

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas capture failed");
      }

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`בקשת_הצעת_מחיר_${formData.shopName}_${Date.now()}.pdf`);

      const response = await fetch("/api/cart/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: formData.shopName,
          firstName: formData.firstName,
          phone: formData.phone || null,
          salespersonName: formData.salespersonName || null,
          items: items.map((item) => ({
            productId: item.product.id,
            productName: item.product.category === "תיק" && item.product.bagName
              ? item.product.bagName
              : item.product.modelRef,
            itemCode: item.product.itemCode || item.product.modelRef,
            category: item.product.category,
            color: item.product.color,
            quantity: item.quantity,
            unitPrice: item.product.priceWholesale,
            totalPrice: item.product.priceWholesale * item.quantity,
          })),
          totalPrice: totalPrice,
        }),
      });

      if (response.ok) {
        clearCart();
        router.push("/cart/success");
      } else {
        console.error("Error saving cart export");
        alert("שגיאה בשליחת הבקשה. נסה שוב.");
      }
    } catch (error) {
      console.error("Error exporting cart:", error);
      alert("שגיאה ביצירת הקובץ. נסה שוב.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-luxury-white">
        <section className="mx-auto max-w-[600px] px-4 py-10">
          <div className="text-center py-20">
            <h1 className="text-2xl font-light text-luxury-noir mb-4">העגלה שלך ריקה</h1>
            <Link
              href="/products"
              className="inline-block mt-6 px-8 py-3 bg-luxury-noir text-luxury-white text-xs font-light tracking-[0.15em] uppercase"
            >
              המשך לקניות
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-luxury-white">
      {/* Hidden PDF content */}
      <div 
        ref={pdfRef} 
        style={{ 
          position: "absolute", 
          left: "-9999px", 
          top: 0, 
          width: "210mm", 
          backgroundColor: "white",
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }} 
        dir="rtl"
      >
        <div 
          className="bg-white p-8" 
          style={{ 
            minHeight: "297mm", 
            width: "210mm",
            fontFamily: "'Segoe UI', Arial, sans-serif", 
            fontSize: "14px",
            backgroundColor: "white",
            color: "black",
          }}
        >
          <h1 className="text-3xl font-bold text-center mb-8">בקשת הצעת מחיר</h1>
          
          <div className="mb-6">
            <p className="text-base mb-2"><strong>שם החנות:</strong> {formData.shopName}</p>
            <p className="text-base mb-2"><strong>שם פרטי:</strong> {formData.firstName}</p>
            {formData.phone && <p className="text-base mb-2"><strong>טלפון:</strong> {formData.phone}</p>}
            {formData.salespersonName && <p className="text-base mb-2"><strong>שם הסוכן:</strong> {formData.salespersonName}</p>}
            <p className="text-base mb-4"><strong>תאריך:</strong> {new Date().toLocaleDateString("he-IL")}</p>
          </div>

          <table className="w-full border-collapse border border-gray-300 mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-3 text-right">מוצר</th>
                <th className="border border-gray-300 p-3 text-center">כמות</th>
                <th className="border border-gray-300 p-3 text-center">מחיר יחידה</th>
                <th className="border border-gray-300 p-3 text-center">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isBag = item.product.category === "תיק";
                const displayName = isBag && item.product.bagName
                  ? item.product.bagName
                  : item.product.modelRef;
                const displayDetail = isBag 
                  ? (item.product.itemCode || item.product.modelRef)
                  : item.product.color;
                const unitPrice = item.product.priceWholesale;
                const itemTotal = unitPrice * item.quantity;
                
                return (
                  <tr key={index}>
                    <td className="border border-gray-300 p-3">
                      <div className="text-sm font-bold">{displayName}</div>
                      {displayDetail && (
                        <div className="text-xs text-gray-600">{displayDetail}</div>
                      )}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">{item.quantity}</td>
                    <td className="border border-gray-300 p-3 text-center">₪{unitPrice.toFixed(2)}</td>
                    <td className="border border-gray-300 p-3 text-center">₪{itemTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="text-right text-lg font-bold mb-6">
            סה"כ כולל: ₪{totalPrice.toFixed(2)}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[600px] px-4 py-6">
        <Link 
          href="/cart"
          className="inline-flex items-center text-sm text-luxury-grey mb-6"
        >
          ← חזרה לעגלה
        </Link>

        <h1 className="text-2xl font-light text-luxury-noir mb-6">פרטי יצירת קשר</h1>
        
        <p className="text-sm text-luxury-grey mb-6">
          הבקשה תועבר ליועץ המכירות שלך שיחזור אליך בהקדם
        </p>

        {/* Order Summary */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-medium mb-2">סיכום הזמנה</h3>
          <p className="text-sm text-gray-600">{items.length} פריטים</p>
          <p className="text-lg font-bold mt-2">₪{totalPrice.toFixed(2)}</p>
        </div>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-light text-luxury-noir mb-2">
              שם החנות <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              className="w-full px-4 py-4 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base rounded-lg"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-light text-luxury-noir mb-2">
              שם פרטי <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-4 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base rounded-lg"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-light text-luxury-noir mb-2">
              מספר טלפון
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-4 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-light text-luxury-noir mb-2">
              אם אתם מכירים את שם הסוכן שלכם, אנא ציינו כאן
            </label>
            <input
              type="text"
              value={formData.salespersonName}
              onChange={(e) => setFormData({ ...formData, salespersonName: e.target.value })}
              className="w-full px-4 py-4 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base rounded-lg"
              placeholder="שם הסוכן (אופציונלי)"
            />
          </div>
        </div>
        
        <div className="space-y-3 pb-8">
          <button
            onClick={handleExport}
            disabled={isSubmitting || !formData.shopName.trim() || !formData.firstName.trim()}
            className="w-full py-4 px-4 bg-black text-white text-base font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "שולח..." : "הורד PDF ושלח"}
          </button>
          
          <Link
            href="/cart"
            className="block w-full py-4 px-4 border border-luxury-grey/30 text-luxury-noir text-center text-base rounded-lg"
          >
            ביטול
          </Link>
        </div>
      </section>
    </main>
  );
}

