import type { UserRole } from "@/features/types/api";

export interface AppUser {
  email: string;
  displayName: string;
  role: UserRole;
}

export const roleLabels: Record<UserRole, string> = {
  worker: "현장 작업자",
  quality_manager: "품질관리자",
  process_manager: "공정관리자",
  admin: "관리자"
};

export const demoUsers: AppUser[] = [
  { email: "worker@example.com", displayName: "현장 작업자", role: "worker" },
  { email: "quality.manager@example.com", displayName: "품질관리자", role: "quality_manager" },
  { email: "process.manager@example.com", displayName: "공정관리자", role: "process_manager" },
  { email: "admin@example.com", displayName: "관리자", role: "admin" }
];

const sessionKey = "quality-agent-session";

export function defaultRouteFor(role: UserRole) {
  return role === "worker" ? "/inspections/new" : "/dashboard";
}

export function canAccess(role: UserRole, href: string) {
  const allowed: Record<UserRole, string[]> = {
    worker: ["/inspections/new", "/inspections", "/agent"],
    quality_manager: ["/inspections/new", "/inspections", "/dashboard", "/agent", "/reports", "/admin/manuals"],
    process_manager: ["/inspections", "/dashboard", "/agent", "/reports"],
    admin: ["/inspections/new", "/inspections", "/dashboard", "/agent", "/reports", "/admin/manuals"]
  };

  return allowed[role].some((path) => href === path || (path !== "/inspections/new" && href.startsWith(path)));
}

export function readSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) as AppUser : null;
  } catch {
    return null;
  }
}

export function saveSession(user: AppUser) {
  window.localStorage.setItem(sessionKey, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(sessionKey);
}
