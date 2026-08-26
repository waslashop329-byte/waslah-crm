import "server-only";
import { getCurrentUser, type CurrentUserContext } from "@/lib/auth/session";

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

// Server actions call this first: throws AuthorizationError (never lets the
// action continue) if there's no session or the role lacks the permission key.
export async function requirePermission(permissionKey: string): Promise<CurrentUserContext> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You must be signed in.");
  if (!user.can(permissionKey)) throw new AuthorizationError();
  return user;
}

export async function requireUser(): Promise<CurrentUserContext> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("You must be signed in.");
  return user;
}
