"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInWithPassword, signOut } from "@/lib/services/auth-service";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export interface LoginFormState {
  error?: string;
}

export async function login(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await signInWithPassword(parsed.data.email, parsed.data.password);

  if (!result.success) {
    return { error: "Incorrect email or password" };
  }

  redirect(parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/dashboard");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
