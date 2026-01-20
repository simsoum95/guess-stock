"use client";

import Link from "next/link";

export default function SuccessPage() {
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-right">
          <p className="text-sm text-blue-800">
            <strong>💡 שים לב:</strong> קובץ ה-PDF נשמר במכשיר שלך. 
            באייפון הוא נפתח בחלון חדש - לחץ על כפתור השיתוף כדי לשמור אותו.
          </p>
        </div>

        <Link
          href="/products"
          className="inline-block px-8 py-4 bg-black text-white text-base font-medium rounded-lg"
        >
          חזרה לקטלוג
        </Link>
      </section>
    </main>
  );
}

