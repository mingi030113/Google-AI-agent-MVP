"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { client } from "@/features/api/client";
import type { AskAgentResponse } from "@/features/types/api";

export default function AgentPage() {
  const [question, setQuestion] = useState("스크래치 불량 조치 순서를 알려줘");
  const [defectType, setDefectType] = useState("scratch");
  const [answer, setAnswer] = useState<AskAgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setAnswer(await client.askAgent({ question, defectType: defectType || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent 응답 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="조치 Agent" description="불량 유형과 질문을 기준으로 조치 기준서 기반 답변을 생성합니다." />
      <div className="grid two">
        <form className="panel form" onSubmit={submit}>
          <div className="field">
            <label>불량 유형</label>
            <select className="select" value={defectType} onChange={(event) => setDefectType(event.target.value)}>
              <option value="">자동</option>
              <option value="scratch">scratch</option>
              <option value="contamination">contamination</option>
              <option value="dent">dent</option>
              <option value="crack">crack</option>
            </select>
          </div>
          <div className="field">
            <label>질문</label>
            <textarea className="textarea" value={question} onChange={(event) => setQuestion(event.target.value)} />
          </div>
          {error ? <div className="error">{error}</div> : null}
          <button className="button" disabled={loading || !question.trim()}>
            <Send size={16} /> {loading ? "생성 중" : "질문하기"}
          </button>
        </form>
        <div className="panel">
          <h2>Agent 답변</h2>
          {!answer ? (
            <div className="empty">질문을 입력하면 답변과 출처가 표시됩니다.</div>
          ) : (
            <div className="grid">
              {answer.fallback ? <div className="error">관련 기준서를 특정하지 못했습니다.</div> : null}
              <p>{answer.answer}</p>
              {!answer.fallback ? (
                <>
                  <h3>체크리스트</h3>
                  <ul className="checklist">
                    {answer.checklist.map((item) => (
                      <li key={item.id}><span>{item.label}</span><span className={`badge ${item.priority}`}>{item.priority}</span></li>
                    ))}
                  </ul>
                </>
              ) : null}
              <h3>출처</h3>
              {answer.sources.length === 0 ? <div className="empty">표시할 출처가 없습니다.</div> : answer.sources.map((source, index) => (
                <div className="card" key={source.id ?? `${source.manualId ?? source.title}-${source.chunkIndex ?? index}`}>
                  <strong>{source.title}</strong>
                  <p>{source.excerpt}</p>
                  <span className="badge">score {source.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
