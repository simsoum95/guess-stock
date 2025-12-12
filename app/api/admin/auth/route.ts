import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "sb-auth-token";

/**
 * POST /api/admin/auth - Login avec email et mot de passe Supabase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "אימייל וסיסמה נדרשים" },
        { status: 400 }
      );
    }

    // Créer le client Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Tentative de connexion
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log("[AUTH] Login failed:", error.message);
      
      // Messages d'erreur en hébreu
      let errorMessage = "שגיאת התחברות";
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "אימייל או סיסמה שגויים";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "האימייל לא אומת";
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 401 }
      );
    }

    if (!data.session) {
      return NextResponse.json(
        { success: false, error: "לא נוצרה סשן" },
        { status: 401 }
      );
    }

    // Créer le cookie avec le token
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: "/",
    });

    console.log("[AUTH] Login successful for:", email);

    return NextResponse.json({
      success: true,
      message: "התחברת בהצלחה"
    });

  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return NextResponse.json(
      { success: false, error: "שגיאה בהתחברות" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth - Logout
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);

    return NextResponse.json({
      success: true,
      message: "התנתקת בהצלחה"
    });

  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return NextResponse.json(
      { success: false, error: "שגיאה בהתנתקות" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auth - Check auth status
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME);
  
  return NextResponse.json({
    authenticated: !!token?.value
  });
}
