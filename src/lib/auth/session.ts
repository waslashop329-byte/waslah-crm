import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, RoleRow } from "@/lib/types/database";

export interface CurrentUserContext {
  userId: string;
  email: string | null;
  profile: ProfileRow;
  role: RoleRow | null;
  isFullAccess: boolean;
  permissions: Set<string>;
  can: (permissionKey: string) => boolean;
}

const FULL_ACCESS_ROLES = new Set(["admin", "manager", "supervisor"]);

// Cached per request: every server component/action on the same request
// reuses this instead of re-querying Supabase.
export const getCurrentUser = cache(async (): Promise<CurrentUserContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) return null;

  const { data: role } = profile.role_id
    ? await supabase.from("roles").select("*").eq("id", profile.role_id).single()
    : { data: null };

  const isFullAccess = role ? FULL_ACCESS_ROLES.has(role.name) : false;
  const permissions = role ? await getRolePermissionKeys(role.id) : new Set<string>();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    role,
    isFullAccess,
    permissions,
    // Full-access roles (admin/manager/supervisor) implicitly pass every check —
    // RLS still scopes what data they can actually reach.
    can: (permissionKey: string) => isFullAccess || permissions.has(permissionKey),
  };
});

const getRolePermissionKeys = cache(async (roleId: string): Promise<Set<string>> => {
  const supabase = await createClient();

  const { data: rolePermissions } = await supabase.from("role_permissions").select("permission_id").eq("role_id", roleId);
  const permissionIds = (rolePermissions ?? []).map((rp) => rp.permission_id);
  if (permissionIds.length === 0) return new Set();

  const { data: permissions } = await supabase.from("permissions").select("key").in("id", permissionIds);
  return new Set((permissions ?? []).map((p) => p.key));
});
