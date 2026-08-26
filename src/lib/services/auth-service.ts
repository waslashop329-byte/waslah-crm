import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  success: boolean;
  error?: string;
}

// Thin service layer around Supabase Auth so route handlers/server actions
// never talk to the Supabase client directly for auth flows.
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signOut(): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
