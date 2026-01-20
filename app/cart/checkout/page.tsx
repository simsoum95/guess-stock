"use client";

import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

  const totalPrice = getTotalPrice();

  const handleSubmit = async () => {
    if (!formData.shopName.trim() || !formData.firstName.trim()) {
      alert("אנא מלא את כל השדות הנדרשים");
      return;
    }

    setIsSubmitting(true);

    try {
      // Send to server FIRST
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
      console.error("Error submitting order:", error);
      alert("שגיאה בשליחת הבקשה. נסה שוב.");
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
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.shopName.trim() || !formData.firstName.trim()}
            className="w-full py-4 px-4 bg-black text-white text-base font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "שולח..." : "שלח בקשה"}
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

