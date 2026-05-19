import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="content" style={{ maxWidth: 460, margin: "80px auto" }}>
      <div className="panel">
        <h1>로그인</h1>
        <div className="form">
          <div className="field">
            <label>이메일</label>
            <input className="input" defaultValue="quality.manager@example.com" />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input className="input" type="password" defaultValue="password" />
          </div>
          <Link className="button" href="/dashboard">
            로그인
          </Link>
        </div>
      </div>
    </main>
  );
}
