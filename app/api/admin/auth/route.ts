import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSession, destroySession, isAuthenticatedFromRequest } from "@/lib/auth";

/**
 * POST /api/admin/auth - Login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: "סיסמה נדרשת" },
        { status: 400 }
      );
    }

    if (!verifyPassword(password)) {
      // Log tentative de connexion échouée
      console.log(`[AUTH] Failed login attempt at ${new Date().toISOString()}`);
      return NextResponse.json(
        { success: false, error: "סיסמה שגויה" },
        { status: 401 }
      );
    }

    // Créer la session
    await createSession();
    
    console.log(`[AUTH] Successful login at ${new Date().toISOString()}`);
    
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
    await destroySession();
    
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
  const isAuth = isAuthenticatedFromRequest(request);
  
  return NextResponse.json({
    authenticated: isAuth
  });
}

