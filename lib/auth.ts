import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// Supabase client pour le serveur
function getSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Cookie name pour stocker le token
const AUTH_COOKIE_NAME = "sb-auth-token";

/**
 * Login avec email et mot de passe via Supabase
 */
export async function loginWithEmail(email: string, password: string): Promise<{
  success: boolean;
  error?: string;
  token?: string;
}> {
  try {
    const supabase = getSupabaseServer();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log("[AUTH] Login failed:", error.message);
      return { success: false, error: error.message };
    }

    if (!data.session) {
      return { success: false, error: "No session created" };
    }

    // Stocker le token dans un cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: "/",
    });

    console.log("[AUTH] Login successful for:", email);
    return { success: true, token: data.session.access_token };

  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return { success: false, error: "שגיאת התחברות" };
  }
}

/**
 * Vérifie si l'utilisateur est authentifié (côté serveur)
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME);
    
    if (!token?.value) {
      return false;
    }

    // Vérifier le token avec Supabase
    const supabase = getSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser(token.value);

    if (error || !user) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Vérifie l'authentification depuis une requête API
 */
export function isAuthenticatedFromRequest(request: NextRequest): boolean {
  const token = request.cookies.get(AUTH_COOKIE_NAME);
  return !!token?.value;
}

/**
 * Récupère le token de session
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME);
    return token?.value || null;
  } catch {
    return null;
  }
}

/**
 * Déconnexion
 */
export async function logout(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
    
    // Aussi déconnecter de Supabase
    const supabase = getSupabaseServer();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
  }
}
