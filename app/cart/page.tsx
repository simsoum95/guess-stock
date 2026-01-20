"use client";

import { useState, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();
  const [showModal, setShowModal] = useState(false);
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
      // Hide modal temporarily for PDF generation
      const modalElement = document.querySelector('[role="dialog"]') as HTMLElement;
      if (modalElement) {
        modalElement.style.display = "none";
      }

      // Make PDF content visible but off-screen for proper rendering
      const element = pdfRef.current;
      if (!element) {
        throw new Error("PDF element not found");
      }

      // Store original styles
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

      // Make element visible but off-screen
      element.style.position = "fixed";
      element.style.left = "0";
      element.style.top = "0";
      element.style.width = "210mm";
      element.style.zIndex = "9999";
      element.style.opacity = "1";
      element.style.visibility = "visible";
      element.style.backgroundColor = "white";

      // Force layout recalculation
      element.offsetHeight;

      // Wait for React to render and fonts to load
      await new Promise(resolve => setTimeout(resolve, 300));

      // Get actual dimensions from scrollWidth/scrollHeight
      const width = element.scrollWidth || element.offsetWidth;
      const height = element.scrollHeight || element.offsetHeight;

      // Convert HTML to canvas with explicit dimensions
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: width,
        height: height,
      });

      // Restore original styles
      element.style.position = originalStyles.position;
      element.style.left = originalStyles.left;
      element.style.top = originalStyles.top;
      element.style.width = originalStyles.width;
      element.style.zIndex = originalStyles.zIndex;
      element.style.opacity = originalStyles.opacity;
      element.style.visibility = originalStyles.visibility;
      element.style.backgroundColor = originalStyles.backgroundColor;

      // Show modal again
      if (modalElement) {
        modalElement.style.display = "";
      }

      // Check if canvas is valid
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas capture failed - empty canvas");
      }

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
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

      // Send to server
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
              : item.product.modelRef, // For shoes, use modelRef instead of productName
            itemCode: item.product.itemCode || item.product.modelRef,
            category: item.product.category,
            color: item.product.color, // Include color for shoes
            quantity: item.quantity,
            unitPrice: item.product.priceWholesale,
            totalPrice: item.product.priceWholesale * item.quantity,
          })),
          totalPrice: totalPrice,
        }),
      });

      if (response.ok) {
        clearCart();
        setShowModal(false);
        setFormData({ shopName: "", firstName: "", phone: "", salespersonName: "" });
        alert("הבקשה נשלחה בהצלחה! היועץ שלך יחזור אליך בהקדם.");
      } else {
        console.error("Error saving cart export");
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
        <section className="mx-auto max-w-[1200px] px-4 sm:px-8 md:px-16 py-10 md:py-20">
          <div className="text-center py-20 md:py-40">
            <h1 className="text-2xl font-light text-luxury-noir mb-4">העגלה שלך ריקה</h1>
            <Link
              href="/products"
              className="inline-block mt-6 px-8 py-3 bg-luxury-noir text-luxury-white text-xs font-light tracking-[0.15em] uppercase hover:bg-luxury-grey transition-colors duration-300"
              style={{ letterSpacing: "0.15em" }}
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
        }} 
        dir="rtl"
      >
        <div 
          className="bg-white p-8" 
          style={{ 
            minHeight: "297mm", 
            width: "210mm",
            fontFamily: "'Segoe UI', 'Arial Unicode MS', 'Noto Sans Hebrew', Arial, sans-serif", 
            fontSize: "14px",
            backgroundColor: "white",
            color: "black",
          }}
        >
          <h1 className="text-3xl font-bold text-center mb-8" style={{ fontFamily: "'Segoe UI', 'Arial Unicode MS', 'Noto Sans Hebrew', Arial, sans-serif" }}>בקשת הצעת מחיר</h1>
          
          <div className="mb-6">
            <p className="text-base mb-2"><strong>שם החנות:</strong> {formData.shopName}</p>
            <p className="text-base mb-2"><strong>שם פרטי:</strong> {formData.firstName}</p>
            {formData.phone && <p className="text-base mb-2"><strong>טלפון:</strong> {formData.phone}</p>}
            {formData.salespersonName && <p className="text-base mb-2"><strong>שם הסוכן:</strong> {formData.salespersonName}</p>}
            <p className="text-base mb-4"><strong>תאריך:</strong> {new Date().toLocaleDateString("he-IL")}</p>
          </div>

          <table className="w-full border-collapse border border-gray-300 mb-6" style={{ fontFamily: "Arial, sans-serif" }}>
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

          <div className="text-center text-sm text-gray-600 mt-8">
            הבקשה תועבר ליועץ המכירות שלך שיחזור אליך בהקדם
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1200px] px-4 sm:px-8 md:px-16 py-6 md:py-20">
        <h1 className="text-2xl md:text-3xl font-light text-luxury-noir mb-6 md:mb-8">העגלה שלי</h1>

        <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
          {items.map((item) => {
            const isBag = item.product.category === "תיק";
            const displayName = isBag && item.product.bagName
              ? item.product.bagName
              : item.product.modelRef;
            const displayDetail = isBag 
              ? (item.product.itemCode || item.product.modelRef)
              : item.product.color;
            
            return (
              <div
                key={item.product.id}
                className="bg-white border border-luxury-grey/20 rounded-lg p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 bg-neutral-50 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={item.product.imageUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-bold text-luxury-noir mb-1 truncate">{displayName}</h3>
                  {displayDetail && (
                    <p className="text-xs text-luxury-grey truncate">{displayDetail}</p>
                  )}
                  <p className="text-sm text-luxury-noir mt-2">₪{item.product.priceWholesale.toFixed(2)}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center border border-luxury-grey/30 hover:border-luxury-noir transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 md:w-12 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center border border-luxury-grey/30 hover:border-luxury-noir transition-colors"
                    >
                      +
                    </button>
                  </div>
                  
                  <p className="text-sm md:text-base font-light text-luxury-noir flex-1 sm:flex-none sm:w-24 text-left">
                    ₪{(item.product.priceWholesale * item.quantity).toFixed(2)}
                  </p>
                  
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-luxury-grey hover:text-luxury-noir transition-colors p-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-luxury-grey/20 pt-4 md:pt-6 mb-6 md:mb-8">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <span className="text-base md:text-lg font-light text-luxury-noir">סה"כ כולל:</span>
            <span className="text-xl md:text-2xl font-light text-luxury-noir">₪{totalPrice.toFixed(2)}</span>
          </div>
          
          <button
            type="button"
            onClick={() => setShowModal(true)}
            onTouchEnd={() => setShowModal(true)}
            className="w-full py-4 px-6 bg-luxury-noir text-luxury-white text-sm font-light tracking-[0.15em] uppercase hover:bg-luxury-grey transition-colors duration-300 active:bg-luxury-grey cursor-pointer select-none"
            style={{ letterSpacing: "0.15em", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            שלח בקשה
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-lg p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-light text-luxury-noir mb-4 sm:mb-6">פרטי יצירת קשר</h2>
              
              <p className="text-sm text-luxury-grey mb-4 sm:mb-6">
                הבקשה תועבר ליועץ המכירות שלך שיחזור אליך בהקדם
              </p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-light text-luxury-noir mb-2">
                    שם החנות <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    className="w-full px-4 py-3 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base"
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
                    className="w-full px-4 py-3 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base"
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
                    className="w-full px-4 py-3 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base"
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
                    className="w-full px-4 py-3 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none text-base"
                    placeholder="שם הסוכן (אופציונלי)"
                  />
                </div>
              </div>
              
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pb-4 sm:pb-0">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 sm:py-3 px-4 border border-luxury-grey/30 text-luxury-noir hover:bg-luxury-grey/10 active:bg-luxury-grey/20 transition-colors text-base"
                  disabled={isSubmitting}
                >
                  ביטול
                </button>
                <button
                  onClick={handleExport}
                  disabled={isSubmitting || !formData.shopName.trim() || !formData.firstName.trim()}
                  className="flex-1 py-4 sm:py-3 px-4 bg-luxury-noir text-luxury-white hover:bg-luxury-grey active:bg-luxury-grey transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {isSubmitting ? "שולח..." : "הורד PDF ושלח"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

