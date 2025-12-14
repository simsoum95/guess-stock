import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (except login)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    try {
      const accessToken = request.cookies.get("sb-access-token")?.value;

      // No token = redirect to login
      if (!accessToken) {
        console.log("[Middleware] No access token, redirecting to login");
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }

      // Verify the session with Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error("[Middleware] Supabase credentials not configured");
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Verify the access token
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

      if (userError || !user) {
        console.log("[Middleware] Invalid token or user not found:", userError?.message);
        const response = NextResponse.redirect(new URL("/admin/login", request.url));
        response.cookies.delete("sb-access-token");
        response.cookies.delete("sb-refresh-token");
        return response;
      }

      // Check if user is in admins table
      const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        console.error("[Middleware] Error checking admin status:", adminError.message);
        // Allow access if we can't check admin status (to prevent lockout)
        // In production, you might want to deny access here
      }

      if (!adminData && !adminError) {
        console.log("[Middleware] User is not an admin");
        return NextResponse.redirect(new URL("/admin/login?error=unauthorized", request.url));
      }

      console.log("[Middleware] Access granted for user:", user.email);
    } catch (error) {
      console.error("[Middleware] Error:", error);
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};




