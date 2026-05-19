"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, ClipboardList, FileText, History, Settings, Upload } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { href: "/inspections/new", label: "새 검사", icon: Upload },
  { href: "/inspections", label: "검사 이력", icon: History },
  { href: "/dashboard", label: "대시보드", icon: BarChart3 },
  { href: "/agent", label: "조치 Agent", icon: Bot },
  { href: "/reports", label: "리포트", icon: FileText },
  { href: "/admin/manuals", label: "매뉴얼", icon: ClipboardList }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Quality Agent</div>
        <nav className="nav">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/inspections/new" && pathname.startsWith(item.href));
            return (
              <Link className={active ? "active" : ""} href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <strong>제조 품질관리 Agent</strong>
          <span className="badge">
            <Settings size={14} /> quality_manager
          </span>
        </header>
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
