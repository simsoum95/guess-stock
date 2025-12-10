import { createServerClient } from "./supabase-server";

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .single();

  return !error && !!data;
}

export async function getAdminByEmail(email: string) {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("email", email)
    .single();

  if (error) return null;
  return data;
}

export async function createAdminUser(email: string, password: string, name?: string) {
  const supabase = createServerClient();

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    throw new Error(authError.message);
  }

  // Add to admins table
  const { error: adminError } = await supabase
    .from("admins")
    .insert({
      user_id: authData.user.id,
      email,
      name: name || email.split("@")[0],
    });

  if (adminError) {
    // Rollback: delete auth user
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(adminError.message);
  }

  return authData.user;
}

