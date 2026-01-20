"use client";

import { useCart } from "@/contexts/CartContext";
import Link from "next/link";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, getTotalPrice } = useCart();

  const totalPrice = getTotalPrice();

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
          
          <Link 
            href="/cart/checkout"
            className="block w-full py-5 px-6 bg-black text-white text-base font-medium tracking-wide uppercase text-center"
            style={{ minHeight: "60px", lineHeight: "28px" }}
          >
            שלח בקשה
          </Link>
        </div>
      </section>
    </main>
  );
}

