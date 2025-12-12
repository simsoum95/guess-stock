"use client";

import { useState } from "react";
import Image from "next/image";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirection forcée avec window.location pour s'assurer que le cookie est pris en compte
        window.location.href = "/admin/upload";
      } else {
        setError(data.error || "שגיאה בהתחברות");
        setIsLoading(false);
      }
    } catch {
      setError("שגיאת חיבור לשרת");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/images/logo-guess.png"
            alt="GUESS"
            width={150}
            height={50}
            className="mx-auto mb-6"
            priority
          />
          <h1 className="text-2xl font-semibold text-gray-900">
            כניסת מנהל
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            הזן את פרטי ההתחברות שלך
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              אימייל
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              placeholder="your@email.com"
              required
              autoFocus
              dir="ltr"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              סיסמה
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              placeholder="הזן סיסמה"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className={`
              w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-200
              ${isLoading || !email || !password
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gray-900 hover:bg-gray-800 active:scale-[0.98]"
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                מתחבר...
              </span>
            ) : (
              "התחבר"
            )}
          </button>
        </form>

        {/* Back link */}
        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-700">
            חזרה לאתר
          </a>
        </div>
      </div>
    </main>
  );
}
