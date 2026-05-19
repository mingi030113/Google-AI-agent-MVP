"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileSearch,
  FileText,
  HelpCircle,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Wrench
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { client, uploadBase } from "@/features/api/client";
import type { AskAgentResponse, InspectionDetail, InspectionListItem } from "@/features/types/api";

const quickQuestionTemplates = [
  { key: "action", label: "조치 순서 알려줘" },
  { key: "reinspection", label: "재검사 기준 알려줘" },
  { key: "cause", label: "원인 점검 항목 알려줘" },
  { key: "worker", label: "작업자 안내 문구 작성" },
  { key: "report", label: "리포트 요약 문구 생성" },
  { key: "similar", label: "유사 사례 찾아줘" }
];

type AgentChatEntry = {
  id: string;
  question: string;
  createdAt: string;
  status: "pending" | "complete" | "error";
  response?: AskAgentResponse;
  errorMessage?: string;
};

export default function AgentPage() {
  const [inspectionOptions, setInspectionOptions] = useState<InspectionListItem[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState("");
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAgentResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<AgentChatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInitialState() {
      setLoading(true);
      setError("");
      try {
        const explicitId = new URLSearchParams(window.location.search).get("inspectionId");
        const list = await client.inspections({ page: "1", pageSize: "8" });
        setInspectionOptions(list.items);

        if (explicitId) {
          setSelectedInspectionId(explicitId);
          await loadInspectionContext(explicitId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "검사 이력을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadInitialState();
  }, []);

  const risk = inspection ? riskFor(inspection) : { label: "-", className: "low" };
  const sourceTitles = useMemo(() => {
    const titles = inspection?.agentGuidance?.sources.map((source) => source.title) ?? [];
    return titles.length > 0 ? titles : ["외관 검사 SOP", "불량 조치 기준서", "설비 점검 기준서", "작업 표준서"];
  }, [inspection]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || !inspection) {
      return;
    }

    const askedQuestion = question.trim();
    const messageId = `chat-${Date.now()}`;
    setQuestion("");
    setChatHistory((current) => [
      ...current,
      {
        id: messageId,
        question: askedQuestion,
        createdAt: new Date().toISOString(),
        status: "pending"
      }
    ]);
    setAsking(true);
    setError("");
    try {
      const response = await client.askAgent({
        question: askedQuestion,
        inspectionId: inspection.id,
        processId: inspection.processId,
        equipmentId: inspection.equipmentId,
        defectType: inspection.defectType ?? undefined
      });
      setAnswer(response);
      setChatHistory((current) => current.map((entry) =>
        entry.id === messageId ? { ...entry, status: "complete", response } : entry
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Agent 응답 생성에 실패했습니다.";
      setError(message);
      setChatHistory((current) => current.map((entry) =>
        entry.id === messageId ? { ...entry, status: "error", errorMessage: message } : entry
      ));
    } finally {
      setAsking(false);
    }
  }

  async function loadInspectionContext(inspectionId = selectedInspectionId) {
    if (!inspectionId) {
      return;
    }

    setContextLoading(true);
    setError("");
    try {
      const detail = await client.inspection(inspectionId);
      setInspection(detail.inspection);
      setAnswer(null);
      setChatHistory([]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "검사 컨텍스트를 불러오지 못했습니다.");
    } finally {
      setContextLoading(false);
    }
  }

  function clearContext() {
    setInspection(null);
    setQuestion("");
    setAnswer(null);
    setChatHistory([]);
  }

  function applyQuickQuestion(label: string) {
    const defectText = inspection?.defectType ? `${inspection.defectType} 불량 ` : "";
    setQuestion(`${defectText}${label}`);
  }

  return (
    <AppShell>
      <div className="agent-titlebar">
        <div>
          <h1><Sparkles size={26} /> 조치 Agent</h1>
          <p>AI 검사 결과와 기준서를 바탕으로 후속 조치를 질의하고 문서화합니다.</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="agent-workspace">
        <aside className="agent-context-card">
          <div className="agent-panel-head">
            <h2><Bot size={18} /> 검사 이력 선택</h2>
            <p>Agent와 대화할 검사 건을 먼저 선택합니다.</p>
          </div>

          {loading ? (
            <div className="empty">검사 이력을 불러오는 중입니다.</div>
          ) : inspectionOptions.length === 0 ? (
            <div className="empty">선택할 검사 이력이 없습니다.</div>
          ) : (
            <>
              <div className="agent-select-box">
                <label>
                  <span>검사 이력</span>
                  <select value={selectedInspectionId} onChange={(event) => setSelectedInspectionId(event.target.value)}>
                    <option value="">검사 이력을 선택하세요</option>
                    {inspectionOptions.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.lotNo} · {item.processName}/{item.equipmentName} · {item.defectType ?? item.result}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button" type="button" disabled={!selectedInspectionId || contextLoading} onClick={() => loadInspectionContext()}>
                  {contextLoading ? "연결 중" : "대화 시작"}
                </button>
              </div>

              {!inspection ? (
                <div className="agent-context-placeholder">
                  <FileSearch size={30} />
                  <strong>검사 이력을 선택하면 컨텍스트가 연결됩니다.</strong>
                  <p>대화를 시작한 뒤 LOT, 공정, 설비, 불량 유형, 신뢰도, 참조 문서가 이 영역에 표시됩니다.</p>
                </div>
              ) : (
                <>
                  <div className="agent-active-context-head">
                    <strong>연결된 검사 컨텍스트</strong>
                    <button type="button" onClick={clearContext}>선택 해제</button>
                  </div>
                  <dl className="agent-context-list">
                    <div><dt>LOT</dt><dd>{inspection.lotNo}</dd></div>
                    <div><dt>공정</dt><dd>{inspection.processName}</dd></div>
                    <div><dt>설비</dt><dd>{inspection.equipmentName}</dd></div>
                    <div><dt>불량 유형</dt><dd>{inspection.defectType ?? "-"}</dd></div>
                    <div><dt>신뢰도</dt><dd>{Math.round(inspection.confidence * 100)}%</dd></div>
                    <div><dt>위험도</dt><dd><span className={`agent-risk ${risk.className}`}>{risk.label}</span></dd></div>
                    <div><dt>상태</dt><dd><span className="agent-status">{statusLabel(inspection.status)}</span></dd></div>
                  </dl>

                  <div className="agent-image-preview">
                    <img src={uploadBase(inspection.imageUrl)} alt="검사 이미지" />
                    {inspection.result === "defective" ? (
                      <span>
                        <em>{inspection.defectType ?? "defect"} {inspection.confidence.toFixed(2)}</em>
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </>
          )}

          {inspection ? (
            <>
              <div className="agent-side-section">
                <h3>빠른 질문</h3>
                <div className="agent-quick-grid">
                  {quickQuestionTemplates.map((item) => (
                    <button type="button" key={item.key} onClick={() => applyQuickQuestion(item.label)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="agent-side-section">
                <h3>참조 문서 범위</h3>
                <div className="agent-source-chips">
                  {sourceTitles.slice(0, 4).map((title) => (
                    <span key={title}><CheckCircle2 size={14} /> {title}</span>
                  ))}
                </div>
              </div>

              <Link className="agent-detail-link" href={`/inspections/${inspection.id}`}>
                검사 상세 보기 <ExternalLink size={15} />
              </Link>
            </>
          ) : null}
        </aside>

        <section className="agent-chat-card">
          <div className="agent-panel-head">
            <h2><Bot size={18} /> Agent 대화</h2>
            <p>검사 이력을 선택한 뒤 해당 검사 결과, 기준서, 조치 이력을 기반으로 답변합니다.</p>
          </div>

          <div className="agent-state-row">
            <span><CheckCircle2 size={16} /> 대화 준비 완료</span>
            <span className={inspection ? "connected" : "pending"}><CheckCircle2 size={16} /> {inspection ? "검사 컨텍스트 연결" : "검사 선택 대기"}</span>
            <span><HelpCircle size={16} /> 질문 대기 중</span>
          </div>

          {chatHistory.length === 0 ? (
            <AgentReadyPanel inspection={inspection} applyQuickQuestion={applyQuickQuestion} />
          ) : (
            <div className="agent-conversation-panel">
              {chatHistory.map((entry) => (
                <AgentChatTurn entry={entry} inspection={inspection} key={entry.id} />
              ))}
            </div>
          )}

          <form className="agent-input-row" onSubmit={submit}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="후속 조치, 재검사 기준, 작업자 안내문 등을 질문하세요."
              maxLength={1000}
              disabled={!inspection}
            />
            <span>{question.length}/1000</span>
            <button className="button" disabled={!inspection || asking || !question.trim()}>
              <Send size={16} /> 전송
            </button>
          </form>

          <p className="agent-disclaimer">이 답변은 내부 기준서와 검사 이력을 기반으로 생성됩니다.</p>
        </section>
      </div>
    </AppShell>
  );
}

function Capability({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

function AgentReadyPanel({
  inspection,
  applyQuickQuestion
}: {
  inspection: InspectionDetail | null;
  applyQuickQuestion: (label: string) => void;
}) {
  return (
    <div className="agent-ready-panel">
      <div className="agent-ready-brand"><Bot size={44} /></div>
      <div>
        <h3>{inspection ? "후속 조치 질의를 시작하세요" : "검사 이력을 선택해 대화를 시작하세요"}</h3>
        <p>
          {inspection
            ? "AI 검사 결과와 내부 기준서를 바탕으로 조치 순서, 재검사 기준, 작업자 안내문, 리포트 반영 문구를 생성합니다."
            : "왼쪽에서 Agent와 대화할 검사 이력을 선택하면 해당 검사 컨텍스트가 연결됩니다."}
        </p>
      </div>
      <div className="agent-capability-grid">
        <Capability icon={<Wrench size={18} />} title="조치 순서 안내" description="불량 대응 절차를 단계별로 안내" />
        <Capability icon={<FileText size={18} />} title="리포트 요약 문구 생성" description="품질 리포트에 반영할 요약 문구 생성" />
        <Capability icon={<RefreshCcw size={18} />} title="재검사 기준 생성" description="재검사 조건 및 승인 기준 정리" />
        <Capability icon={<Search size={18} />} title="유사 사례 검색" description="과거 유사 불량 사례와 조치 이력 검색" />
        <Capability icon={<ClipboardList size={18} />} title="작업자 전달용 안내문 작성" description="현장 작업자에게 전달할 안내문 자동 작성" />
      </div>

      <div className="agent-suggestion-row">
        <strong>추천 질문</strong>
        <div>
          {quickQuestionTemplates.slice(0, 5).map((item) => (
            <button type="button" key={item.key} onClick={() => applyQuickQuestion(item.label)} disabled={!inspection}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="agent-waiting-box">
        <FileSearch size={34} />
        <div>
          <strong>Agent 답변 대기 중</strong>
          <p>질문을 입력하면 AI가 답변을 생성합니다.</p>
        </div>
      </div>
    </div>
  );
}

function AgentChatTurn({ entry, inspection }: { entry: AgentChatEntry; inspection: InspectionDetail | null }) {
  return (
    <article className="agent-chat-turn">
      <div className="agent-user-bubble">
        <span>사용자</span>
        <p>{entry.question}</p>
        <time>{formatTime(entry.createdAt)}</time>
      </div>

      <div className="agent-response-shell">
        <div className="agent-avatar"><Bot size={20} /></div>
        {entry.status === "pending" ? (
          <div className="agent-response-loading">
            <strong>Agent가 답변을 생성하고 있습니다.</strong>
            <p>검사 결과, 기준서, 조치 이력을 조회해 응답을 구성합니다.</p>
          </div>
        ) : entry.status === "error" ? (
          <div className="error">{entry.errorMessage}</div>
        ) : entry.response ? (
          <AgentStructuredAnswer response={entry.response} inspection={inspection} />
        ) : null}
      </div>
    </article>
  );
}

function AgentStructuredAnswer({ response, inspection }: { response: AskAgentResponse; inspection: InspectionDetail | null }) {
  const reinspectionItems = buildReinspectionItems(response, inspection);
  const workerMessage = buildWorkerMessage(response, inspection);
  const averageScore = response.sources.length === 0
    ? 0
    : Math.round((response.sources.reduce((sum, source) => sum + source.score, 0) / response.sources.length) * 100) / 100;

  return (
    <div className="agent-structured-answer">
      <div className="agent-answer-badges">
        <span><CheckCircle2 size={14} /> RAG 검색 완료</span>
        <span><CheckCircle2 size={14} /> 참조 문서 {response.sources.length}건</span>
        {averageScore > 0 ? <span>평균 유사도 {averageScore.toFixed(2)}</span> : null}
        <span><CheckCircle2 size={14} /> 응답 생성 완료</span>
      </div>

      <section className="agent-answer-summary">
        <strong>요약 답변</strong>
        <p>{response.answer}</p>
      </section>

      <div className="agent-answer-grid">
        <section>
          <strong>권장 조치 순서</strong>
          <ol className="agent-step-list">
            {response.checklist.map((item, index) => (
              <li key={item.id}>
                <span>{index + 1}</span>
                <p>{item.label}</p>
                <em className={item.priority}>{priorityLabel(item.priority)}</em>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <strong>재검사 기준</strong>
          <ul className="agent-bullet-list">
            {reinspectionItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section>
          <strong>작업자 전달용 안내문</strong>
          <p className="agent-worker-note">{workerMessage}</p>
        </section>
      </div>

      <section className="agent-rag-section">
        <strong>RAG 참조 근거</strong>
        {response.sources.length === 0 ? (
          <div className="empty">표시할 참조 근거가 없습니다.</div>
        ) : (
          <div className="agent-rag-grid">
            {response.sources.map((source, index) => (
              <article key={source.id ?? `${source.title}-${index}`}>
                <FileText size={16} />
                <div>
                  <strong>{source.title}</strong>
                  <p>{source.excerpt}</p>
                  <Link href="/admin/manuals">문서 보기 <ExternalLink size={12} /></Link>
                </div>
                <span>유사도 {source.score.toFixed(2)}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="agent-next-actions">
        <strong>다음 작업</strong>
        <div>
          {inspection ? <Link href={`/inspections/${inspection.id}`}><ExternalLink size={15} /> 검사 상세로 이동</Link> : null}
          <button type="button"><ClipboardList size={15} /> 조치 체크리스트 생성</button>
          <Link href="/reports"><FileText size={15} /> 리포트에 반영</Link>
          <button type="button"><FileText size={15} /> 작업자 안내문 저장</button>
        </div>
      </section>
    </div>
  );
}

function riskFor(inspection: InspectionDetail) {
  if (inspection.status === "action_required" || (inspection.result === "defective" && inspection.confidence >= 0.9)) {
    return { label: "High", className: "high" };
  }
  if (inspection.result === "defective") {
    return { label: "Medium", className: "medium" };
  }
  return { label: "Low", className: "low" };
}

function statusLabel(status: string) {
  return {
    pending: "확인 대기",
    reviewed: "확인 완료",
    action_required: "조치 필요",
    closed: "처리 완료"
  }[status] ?? status;
}

function buildReinspectionItems(response: AskAgentResponse, inspection: InspectionDetail | null) {
  const candidates = response.checklist
    .map((item) => item.label)
    .filter((label) => /재검사|확인|점검|승인|기준|기록/.test(label))
    .slice(0, 3);

  if (candidates.length > 0) {
    return candidates;
  }

  const sourceItems = response.sources
    .map((source) => source.excerpt)
    .filter(Boolean)
    .slice(0, 2);

  if (sourceItems.length > 0) {
    return sourceItems;
  }

  return inspection
    ? [`${inspection.lotNo} 조치 완료 후 동일 LOT 재검사 결과를 피드백에 기록합니다.`]
    : ["조치 완료 후 재검사 결과를 피드백에 기록합니다."];
}

function buildWorkerMessage(response: AskAgentResponse, inspection: InspectionDetail | null) {
  const target = inspection
    ? `${inspection.processName} ${inspection.equipmentName}의 ${inspection.lotNo}`
    : "선택한 검사 건";
  const firstAction = response.checklist[0]?.label ?? response.answer;
  const recheck = buildReinspectionItems(response, inspection)[0];

  return `${target}에 대해 ${firstAction} 조치를 우선 수행한 뒤, ${recheck} 작업을 완료하고 결과를 검사 피드백에 기록해 주세요.`;
}

function priorityLabel(priority: string) {
  return {
    high: "긴급",
    medium: "점검",
    low: "확인"
  }[priority] ?? priority;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
