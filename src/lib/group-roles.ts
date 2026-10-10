import type { GroupRole } from "@/types";

export function formatGroupRoleLabel(role: GroupRole | string | null | undefined): string {
  if (role === "owner") return "Admin";
  if (role === "admin") return "Co-admin";
  return "Member";
}

/** DB role `owner` — displayed as Admin in the UI. */
export function isGroupAdminRole(role: GroupRole | string | null | undefined): boolean {
  return role === "owner";
}

export function canManageGroup(role: GroupRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canPromoteToCoAdmin(callerRole: GroupRole | null | undefined): boolean {
  return callerRole === "owner";
}

/** Who may remove whom (leave = isSelf). Admin (owner) cannot be removed. */
export function canRemoveGroupMember(
  callerRole: GroupRole | null | undefined,
  targetRole: GroupRole,
  isSelf: boolean
): boolean {
  if (targetRole === "owner") return false;
  if (isSelf) return true;
  if (callerRole === "owner") return targetRole === "member" || targetRole === "admin";
  if (callerRole === "admin") return targetRole === "member";
  return false;
}
