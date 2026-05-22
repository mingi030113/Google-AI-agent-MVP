"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bot, ClipboardList, Factory, FileText, History, LogOut, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { canAccess, clearSession, defaultRouteFor, readSession, roleLabels } from "@/features/auth/session";
import type { AppUser } from "@/features/auth/session";

const nav = [
  { href: "/dashboard", label: "대시보드", icon: BarChart3 },
  { href: "/inspections/new", label: "AI검사", icon: Upload },
  { href: "/inspections", label: "검사 이력", icon: History },
  { href: "/agent", label: "조치 Agent", icon: Bot },
  { href: "/reports", label: "보고서", icon: FileText },
  { href: "/admin/manuals", label: "메뉴얼 관리", icon: ClipboardList }
];

const pageTitles: Record<string, string> = {
  "/inspections/new": "AI검사",
  "/inspections": "검사 이력",
  "/dashboard": "대시보드",
  "/agent": "조치 Agent",
  "/reports": "보고서",
  "/admin/manuals": "메뉴얼 관리"
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    setUser(session);
    setReady(true);
    if (!canAccess(session.role, pathname)) {
      router.replace(defaultRouteFor(session.role));
    }
  }, [pathname, router]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  if (!ready || !user) {
    return <main className="content"><div className="empty">세션을 확인하는 중입니다.</div></main>;
  }

  const visibleNav = nav.filter((item) => canAccess(user.role, item.href));
  const currentTitle = pageTitles[pathname] ?? (pathname.startsWith("/inspections/") ? "검사 상세" : "제조 품질관리 Agent");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Factory size={20} /></div>
          <div>
            <span className="brand-title">Quality Agent</span>
            <span className="brand-subtitle">Manufacturing AX</span>
          </div>
        </div>
        <div className="nav-wrap">
          <div className="nav-label">Workspace</div>
          <nav className="nav">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/inspections"
                ? pathname === "/inspections" || (pathname.startsWith("/inspections/") && pathname !== "/inspections/new")
                : pathname === item.href || (item.href !== "/inspections/new" && pathname.startsWith(item.href));
              return (
                <Link className={active ? "active" : ""} href={item.href} key={item.href}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <strong>{currentTitle}</strong>
            <span>검사, 조치 기준, 리포트를 한 흐름에서 관리합니다.</span>
          </div>
          <div className="topbar-actions">
            <div className="topbar-user" aria-label="현재 사용자">
              <span className="topbar-user-avatar">{user.displayName.slice(0, 1)}</span>
              <span>
                <strong>{user.displayName}</strong>
                <small>{roleLabels[user.role]}</small>
              </span>
            </div>
            <button className="button secondary" onClick={logout} type="button">
              <LogOut size={16} /> 로그아웃
            </button>
          </div>
        </header>
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
