import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; // À changer en production!
const SESSION_COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 heures

/**
 * Génère un token de session sécurisé
 */
function generateSessionToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${random}${random2}`;
}

/**
 * Hash simple pour vérification (en production, utiliser bcrypt)
 */
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Vérifie si le mot de passe est correct
 */
export function verifyPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

/**
 * Crée une session admin
 */
export async function createSession(): Promise<string> {
  const token = generateSessionToken();
  const cookieStore = await cookies();
  
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  
  return token;
}

/**
 * Vérifie si l'utilisateur est authentifié (côté serveur)
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);
    return !!session?.value;
  } catch {
    return false;
  }
}

/**
 * Vérifie l'authentification depuis une requête API
 */
export function isAuthenticatedFromRequest(request: NextRequest): boolean {
  const session = request.cookies.get(SESSION_COOKIE_NAME);
  return !!session?.value;
}

/**
 * Supprime la session (déconnexion)
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Récupère le token de session actuel
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);
    return session?.value || null;
  } catch {
    return null;
  }
}

