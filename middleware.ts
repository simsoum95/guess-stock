import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie de session
const SESSION_COOKIE_NAME = "admin_session";

// Pages publiques dans /admin (qui n'ont pas besoin d'auth)
const PUBLIC_ADMIN_PATHS = [
  "/admin/login",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Si ce n'est pas une route admin, laisser passer
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // Vérifier si c'est une page publique admin
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some(path => pathname === path || pathname.startsWith(path + "/"));
  
  // Vérifier si c'est l'API d'auth (toujours accessible)
  const isAuthAPI = pathname === "/api/admin/auth";
  
  if (isPublicAdminPath || isAuthAPI) {
    return NextResponse.next();
  }

  // Vérifier la session
  const session = request.cookies.get(SESSION_COOKIE_NAME);
  const isAuthenticated = !!session?.value;

  // Si pas authentifié
  if (!isAuthenticated) {
    // Pour les API, retourner 401
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { success: false, error: "לא מורשה - נדרשת התחברות" },
        { status: 401 }
      );
    }
    
    // Pour les pages admin, rediriger vers login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Si authentifié et essaie d'accéder au login, rediriger vers upload
  if (isAuthenticated && pathname === "/admin/login") {
    return NextResponse.redirect(new URL("/admin/upload", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Toutes les routes admin
    "/admin/:path*",
    // Toutes les API admin
    "/api/admin/:path*",
  ],
};
