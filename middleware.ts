import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie de session Supabase
const AUTH_COOKIE_NAME = "sb-auth-token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Ignorer les routes non-admin
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // Routes publiques (login)
  if (pathname === "/admin/login" || pathname === "/api/admin/auth") {
    // Si déjà connecté et essaie d'accéder au login, rediriger vers upload
    const token = request.cookies.get(AUTH_COOKIE_NAME);
    if (token?.value && pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin/upload", request.url));
    }
    return NextResponse.next();
  }

  // Vérifier l'authentification pour les routes protégées
  const token = request.cookies.get(AUTH_COOKIE_NAME);
  
  if (!token?.value) {
    // API: retourner 401
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { success: false, error: "לא מורשה - נדרשת התחברות" },
        { status: 401 }
      );
    }
    
    // Pages: rediriger vers login
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
