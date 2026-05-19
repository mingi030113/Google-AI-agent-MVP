"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { defaultRouteFor, demoUsers, roleLabels, saveSession } from "@/features/auth/session";
import type { UserRole } from "@/features/types/api";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("quality_manager");
  const selectedUser = demoUsers.find((user) => user.role === role) ?? demoUsers[1];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSession(selectedUser);
    router.push(defaultRouteFor(selectedUser.role));
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <h1>로그인</h1>
        <p>시연용 역할을 선택하면 해당 권한의 작업 화면으로 이동합니다.</p>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label>역할</label>
            <select className="select" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {demoUsers.map((user) => (
                <option key={user.role} value={user.role}>{roleLabels[user.role]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>이메일</label>
            <input className="input" value={selectedUser.email} readOnly />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input className="input" type="password" defaultValue="password" />
          </div>
          <button className="button" type="submit">로그인</button>
        </form>
      </div>
    </main>
  );
}
