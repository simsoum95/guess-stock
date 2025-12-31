"use client";

import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import Link from "next/link";
import jsPDF from "jspdf";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    shopName: "",
    firstName: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPrice = getTotalPrice();

  const handleExport = async () => {
    if (!formData.shopName.trim() || !formData.firstName.trim()) {
      alert("אנא מלא את כל השדות הנדרשים");
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate PDF
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text("בקשת הצעת מחיר", 105, 20, { align: "center" });
      
      // Customer info
      doc.setFontSize(12);
      let yPos = 35;
      doc.text(`שם החנות: ${formData.shopName}`, 20, yPos);
      yPos += 8;
      doc.text(`שם פרטי: ${formData.firstName}`, 20, yPos);
      if (formData.phone) {
        yPos += 8;
        doc.text(`טלפון: ${formData.phone}`, 20, yPos);
      }
      yPos += 15;
      
      // Date
      const date = new Date().toLocaleDateString("he-IL");
      doc.text(`תאריך: ${date}`, 20, yPos);
      yPos += 15;
      
      // Items table header
      doc.setFontSize(10);
      doc.text("מוצר", 20, yPos);
      doc.text("כמות", 100, yPos);
      doc.text("מחיר יחידה", 130, yPos);
      doc.text("סה\"כ", 170, yPos);
      yPos += 8;
      
      // Items
      doc.setFontSize(9);
      items.forEach((item) => {
        const productName = item.product.category === "תיק" && item.product.bagName
          ? item.product.bagName
          : item.product.productName || item.product.modelRef;
        const itemCode = item.product.itemCode || item.product.modelRef;
        const unitPrice = item.product.priceWholesale;
        const itemTotal = unitPrice * item.quantity;
        
        // Wrap long text
        const lines = doc.splitTextToSize(`${productName} (${itemCode})`, 70);
        lines.forEach((line: string, index: number) => {
          doc.text(line, 20, yPos + (index * 5));
        });
        doc.text(item.quantity.toString(), 100, yPos);
        doc.text(`₪${unitPrice.toFixed(2)}`, 130, yPos);
        doc.text(`₪${itemTotal.toFixed(2)}`, 170, yPos);
        yPos += Math.max(lines.length * 5, 10);
      });
      
      yPos += 10;
      doc.setFontSize(12);
      doc.text(`סה\"כ כולל: ₪${totalPrice.toFixed(2)}`, 170, yPos, { align: "right" });
      
      yPos += 20;
      doc.setFontSize(10);
      doc.text("הבקשה תועבר ליועץ המכירות שלך שיחזור אליך בהקדם", 105, yPos, { align: "center" });
      
      // Save PDF
      doc.save(`בקשת_הצעת_מחיר_${formData.shopName}_${Date.now()}.pdf`);

      // Send to server
      const response = await fetch("/api/cart/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: formData.shopName,
          firstName: formData.firstName,
          phone: formData.phone || null,
          items: items.map((item) => ({
            productId: item.product.id,
            productName: item.product.category === "תיק" && item.product.bagName
              ? item.product.bagName
              : item.product.productName || item.product.modelRef,
            itemCode: item.product.itemCode || item.product.modelRef,
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
        setFormData({ shopName: "", firstName: "", phone: "" });
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
        <section className="mx-auto max-w-[1200px] px-16 py-20">
          <div className="text-center py-40">
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
      <section className="mx-auto max-w-[1200px] px-16 py-20">
        <h1 className="text-3xl font-light text-luxury-noir mb-8">העגלה שלי</h1>

        <div className="space-y-6 mb-8">
          {items.map((item) => {
            const productName = item.product.category === "תיק" && item.product.bagName
              ? item.product.bagName
              : item.product.productName || item.product.modelRef;
            const itemCode = item.product.itemCode || item.product.modelRef;
            
            return (
              <div
                key={item.product.id}
                className="bg-white border border-luxury-grey/20 rounded-lg p-6 flex items-center gap-6"
              >
                <div className="w-24 h-24 bg-neutral-50 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={item.product.imageUrl}
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-base font-light text-luxury-noir mb-1">{productName}</h3>
                  <p className="text-xs text-luxury-grey">{itemCode}</p>
                  <p className="text-sm text-luxury-noir mt-2">₪{item.product.priceWholesale.toFixed(2)}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center border border-luxury-grey/30 hover:border-luxury-noir transition-colors"
                    >
                      -
                    </button>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center border border-luxury-grey/30 hover:border-luxury-noir transition-colors"
                    >
                      +
                    </button>
                  </div>
                  
                  <p className="text-base font-light text-luxury-noir w-24 text-left">
                    ₪{(item.product.priceWholesale * item.quantity).toFixed(2)}
                  </p>
                  
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-luxury-grey hover:text-luxury-noir transition-colors"
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

        <div className="border-t border-luxury-grey/20 pt-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-light text-luxury-noir">סה"כ כולל:</span>
            <span className="text-2xl font-light text-luxury-noir">₪{totalPrice.toFixed(2)}</span>
          </div>
          
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-4 px-6 bg-luxury-noir text-luxury-white text-sm font-light tracking-[0.15em] uppercase hover:bg-luxury-grey transition-colors duration-300"
            style={{ letterSpacing: "0.15em" }}
          >
            שלח בקשה
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-xl font-light text-luxury-noir mb-6">פרטי יצירת קשר</h2>
              
              <p className="text-sm text-luxury-grey mb-6">
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
                    className="w-full px-4 py-2 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none"
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
                    className="w-full px-4 py-2 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none"
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
                    className="w-full px-4 py-2 border border-luxury-grey/30 focus:border-luxury-noir focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 px-4 border border-luxury-grey/30 text-luxury-noir hover:bg-luxury-grey/10 transition-colors"
                  disabled={isSubmitting}
                >
                  ביטול
                </button>
                <button
                  onClick={handleExport}
                  disabled={isSubmitting || !formData.shopName.trim() || !formData.firstName.trim()}
                  className="flex-1 py-3 px-4 bg-luxury-noir text-luxury-white hover:bg-luxury-grey transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

