"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileText,
  Gauge,
  MessageSquareText,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
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

const agentHandoffKey = "quality-agent-inspection-handoff";

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
        const handoffInspection = explicitId ? readAgentHandoff(explicitId) : null;
        const list = await client.inspections({ page: "1", pageSize: "8" });
        setInspectionOptions(mergeInspectionOption(list.items, handoffInspection));

        if (explicitId) {
          setSelectedInspectionId(explicitId);
          await loadInspectionContext(explicitId, handoffInspection);
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
  const lastTurn = chatHistory.at(-1);
  const evidenceResponse = answer;
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

  async function loadInspectionContext(inspectionId = selectedInspectionId, fallbackInspection?: InspectionDetail | null) {
    if (!inspectionId) {
      return;
    }

    setContextLoading(true);
    setError("");
    try {
      const detail = await client.inspection(inspectionId);
      setInspection(detail.inspection);
      setInspectionOptions((items) => mergeInspectionOption(items, detail.inspection));
      setAnswer(null);
      setChatHistory([]);
      setQuestion("");
    } catch (err) {
      const handoffInspection = fallbackInspection ?? readAgentHandoff(inspectionId);
      if (handoffInspection) {
        setInspection(handoffInspection);
        setInspectionOptions((items) => mergeInspectionOption(items, handoffInspection));
        setAnswer(null);
        setChatHistory([]);
        setQuestion("");
        setError("");
        return;
      }
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
          <h1><Sparkles size={26} /> Agent 대화</h1>
          <p>검사 이력을 선택한 뒤 해당 검사 결과, 기준서, 조치 이력을 기반으로 답변합니다.</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="agent-workspace">
        <aside className="agent-context-card">
          <div className="agent-panel-head">
            <h2><Bot size={18} /> 검사 컨텍스트</h2>
            <p>Agent가 참조할 검사 건을 선택합니다.</p>
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
                <div className="agent-select-actions">
                  <button className="button" type="button" disabled={!selectedInspectionId || contextLoading} onClick={() => loadInspectionContext()}>
                    {contextLoading ? "연결 중" : "대화 시작"}
                  </button>
                </div>
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
                    <div>
                      <span>현재 분석 대상</span>
                      <strong>{inspection.id}</strong>
                    </div>
                    <button type="button" onClick={clearContext}>선택 해제</button>
                  </div>
                  <div className="agent-image-preview">
                    <img src={uploadBase(inspection.imageUrl)} alt="검사 이미지" />
                    {inspection.result === "defective" ? (
                      <span>
                        <em>{inspection.defectType ?? "defect"} {inspection.confidence.toFixed(2)}</em>
                      </span>
                    ) : null}
                  </div>
                  <div className="agent-context-summary">
                    <span className={`agent-risk ${inspection.result === "defective" ? "medium" : "low"}`}>
                      {inspection.result === "defective" ? "불량" : "정상"}
                    </span>
                    <span className={`agent-risk ${risk.className}`}>{risk.label}</span>
                    <span className="agent-status">{statusLabel(inspection.status)}</span>
                  </div>
                  <dl className="agent-context-list">
                    <div><dt>LOT 번호</dt><dd>{inspection.lotNo}</dd></div>
                    <div><dt>검사 일시</dt><dd>{formatDateTime(inspection.inspectedAt)}</dd></div>
                    <div><dt>설비</dt><dd>{inspection.equipmentName}</dd></div>
                    <div><dt>공정</dt><dd>{inspection.processName}</dd></div>
                    <div><dt>불량 유형</dt><dd>{inspection.defectType ?? "-"}</dd></div>
                    <div><dt>판정 결과</dt><dd><span className={`agent-risk ${inspection.result === "defective" ? "medium" : "low"}`}>{inspection.result === "defective" ? "불량" : "정상"}</span></dd></div>
                    <div><dt>위험도</dt><dd><span className={`agent-risk ${risk.className}`}>{risk.label}</span></dd></div>
                    <div><dt>조치 상태</dt><dd><span className="agent-status">{statusLabel(inspection.status)}</span></dd></div>
                  </dl>
                </>
              )}
            </>
          )}

          {inspection ? (
            <>
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
          {chatHistory.length === 0 ? (
            <AgentReadyPanel inspection={inspection} applyQuickQuestion={applyQuickQuestion} />
          ) : (
            <div className="agent-conversation-panel">
              {chatHistory.map((entry) => (
                <AgentChatTurn entry={entry} inspection={inspection} key={entry.id} isLatest={entry.id === lastTurn?.id} />
              ))}
            </div>
          )}

          <form className="agent-input-row" onSubmit={submit}>
            <div className="agent-input-icon"><Bot size={18} /></div>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="원인, 조치 순서, 재검사 기준을 질문하세요."
              maxLength={1000}
              disabled={!inspection}
            />
            <div className="agent-input-meta">
              <span>{inspection ? "선택된 검사 컨텍스트 기준" : "검사 컨텍스트 필요"}</span>
              <em>{question.length}/1000</em>
            </div>
            <button className="button" disabled={!inspection || asking || !question.trim()}>
              <Send size={16} />
              <span>전송</span>
            </button>
          </form>

          <p className="agent-disclaimer">이 답변은 내부 기준서와 검사 이력을 기반으로 생성됩니다.</p>
        </section>

        <AgentEvidencePanel response={evidenceResponse} />
      </div>
    </AppShell>
  );
}

function readAgentHandoff(inspectionId: string) {
  try {
    const raw = window.sessionStorage.getItem(agentHandoffKey);
    if (!raw) {
      return null;
    }
    const inspection = JSON.parse(raw) as InspectionDetail;
    return inspection.id === inspectionId ? inspection : null;
  } catch {
    return null;
  }
}

function mergeInspectionOption(items: InspectionListItem[], inspection: InspectionDetail | null) {
  if (!inspection || items.some((item) => item.id === inspection.id)) {
    return items;
  }

  return [{
    id: inspection.id,
    imageUrl: inspection.imageUrl,
    processName: inspection.processName,
    equipmentName: inspection.equipmentName,
    lotNo: inspection.lotNo,
    result: inspection.result,
    defectType: inspection.defectType,
    confidence: inspection.confidence,
    status: inspection.status,
    inspectedAt: inspection.inspectedAt
  }, ...items];
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
      <div className="agent-ready-hero">
        <div className="agent-ready-brand"><Bot size={38} /></div>
        <div>
          <span>{inspection ? "검사 컨텍스트 연결됨" : "컨텍스트 대기"}</span>
          <h3>{inspection ? "무엇을 확인할까요?" : "검사 이력을 선택해 대화를 시작하세요"}</h3>
          <p>
            {inspection
              ? `${inspection.lotNo} · ${inspection.equipmentName} · ${inspection.defectType ?? "검사 결과"} 기준으로 기준서와 유사 조치 이력을 함께 조회합니다.`
              : "왼쪽에서 Agent와 대화할 검사 이력을 선택하면 해당 검사 컨텍스트가 연결됩니다."}
          </p>
        </div>
      </div>

      <div className="agent-ready-flow">
        <span><CheckCircle2 size={14} /> 검사 컨텍스트</span>
        <span><BookOpen size={14} /> 기준서 검색</span>
        <span><Gauge size={14} /> 유사 이력 비교</span>
        <span><ShieldCheck size={14} /> 조치 답변 생성</span>
      </div>

      <div className="agent-question-card-grid">
        <button type="button" onClick={() => applyQuickQuestion("원인 점검 항목 알려줘")} disabled={!inspection}>
          <span><Search size={18} /></span>
          <strong>원인 분석</strong>
          <p>불량 원인과 우선 점검 항목 확인</p>
        </button>
        <button type="button" onClick={() => applyQuickQuestion("조치 순서 알려줘")} disabled={!inspection}>
          <span><Wrench size={18} /></span>
          <strong>재발 방지 조치</strong>
          <p>현장 조치 순서와 예방 대책 정리</p>
        </button>
        <button type="button" onClick={() => applyQuickQuestion("재검사 기준 알려줘")} disabled={!inspection}>
          <span><RefreshCcw size={18} /></span>
          <strong>재검사 기준</strong>
          <p>합격 기준과 확인 조건 생성</p>
        </button>
        <button type="button" onClick={() => applyQuickQuestion("작업자 안내 문구 작성")} disabled={!inspection}>
          <span><MessageSquareText size={18} /></span>
          <strong>작업자 안내</strong>
          <p>현장 전달용 안내 문구 작성</p>
        </button>
      </div>

      <div className="agent-waiting-box">
        <span className="agent-live-dot" />
        <div>
          <strong>{inspection ? "Agent 준비 완료" : "검사 컨텍스트를 기다리는 중"}</strong>
          <p>{inspection ? "질문을 입력하면 기준서와 유사 조치 이력을 조회한 뒤 답변합니다." : "검사 이력을 연결하면 추천 질문이 활성화됩니다."}</p>
        </div>
      </div>
    </div>
  );
}

function AgentChatTurn({
  entry,
  inspection,
  isLatest
}: {
  entry: AgentChatEntry;
  inspection: InspectionDetail | null;
  isLatest: boolean;
}) {
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
          <AgentActivityStream />
        ) : entry.status === "error" ? (
          <div className="error">{entry.errorMessage}</div>
        ) : entry.response ? (
          <AgentStructuredAnswer response={entry.response} inspection={inspection} animate={isLatest} />
        ) : null}
      </div>
    </article>
  );
}

function AgentActivityStream() {
  return (
    <div className="agent-response-loading">
      <div className="agent-live-line">
        <span className="agent-live-dot" />
        <p>
          <span>검사 컨텍스트 확인 중</span>
          <em>RAG 기준서 검색 중</em>
          <em>유사 조치 이력 비교 중</em>
          <em>답변 문장 구성 중</em>
        </p>
      </div>
      <div className="agent-loading-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function AgentStructuredAnswer({
  response,
  inspection,
  animate
}: {
  response: AskAgentResponse;
  inspection: InspectionDetail | null;
  animate: boolean;
}) {
  const reinspectionItems = buildReinspectionItems(response, inspection);
  const workerMessage = buildWorkerMessage(response, inspection);
  const typedAnswer = useTypewriter(response.answer, animate ? 12 : 0);
  const isTyping = typedAnswer.length < response.answer.length;
  const similarCount = response.similarCases?.length ?? 0;

  return (
    <div className="agent-structured-answer">
      <div className="agent-answer-decision-head">
        <div>
          <span className="agent-status-light" />
          <strong>AI 판단 결과</strong>
          <p>{inspection ? `${inspection.equipmentName} · ${inspection.defectType ?? "검사"} 기준 분석` : "기준서 기반 조치 분석"}</p>
        </div>
        <em className={isTyping ? "" : "complete"}>{isTyping ? "응답 생성 중" : "판단 완료"}</em>
      </div>

      <div className="agent-answer-insight-row">
        <span><BookOpen size={14} /> 기준서 {response.sources.length}건</span>
        <span><Gauge size={14} /> 유사 이력 {similarCount}건</span>
        <span><ShieldCheck size={14} /> RAG 기반</span>
      </div>

      <section className="agent-answer-summary">
        <strong>핵심 판단</strong>
        <p>
          {typedAnswer}
          {isTyping ? <span className="agent-type-cursor" /> : null}
        </p>
      </section>

      <div className="agent-answer-grid">
        <section className="agent-reveal-section" style={{ animationDelay: "120ms" }}>
          <strong>권장 조치</strong>
          <ol className="agent-step-list">
            {response.checklist.map((item, index) => (
              <li key={item.id} style={{ animationDelay: `${220 + index * 90}ms` }}>
                <span>{index + 1}</span>
                <p>{item.label}</p>
                <em className={item.priority}>{priorityLabel(item.priority)}</em>
              </li>
            ))}
          </ol>
        </section>

        <section className="agent-reveal-section" style={{ animationDelay: "260ms" }}>
          <strong>재검사 체크리스트</strong>
          <ul className="agent-bullet-list">
            {reinspectionItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="agent-reveal-section" style={{ animationDelay: "380ms" }}>
          <strong>작업자 전달용 안내문</strong>
          <p className="agent-worker-note">{workerMessage}</p>
        </section>
      </div>

      <section className="agent-next-actions">
        <strong>다음 작업</strong>
        <div className="agent-action-grid">
          {inspection ? (
            <Link className="agent-action-card" href={`/inspections/${inspection.id}`}>
              <span><ExternalLink size={17} /></span>
              <strong>검사 상세 확인</strong>
              <p>원본 이미지와 판정 이력을 다시 확인</p>
              <em>열기 <ArrowRight size={13} /></em>
            </Link>
          ) : null}
          <button className="agent-action-card" type="button">
            <span><ClipboardList size={17} /></span>
            <strong>조치 체크리스트 생성</strong>
            <p>권장 조치를 실행 항목으로 전환</p>
            <em>생성 <ArrowRight size={13} /></em>
          </button>
          <Link className="agent-action-card" href="/reports">
            <span><FileCheck2 size={17} /></span>
            <strong>보고서 반영</strong>
            <p>이번 검사 요약을 품질 리포트에 추가</p>
            <em>반영 <ArrowRight size={13} /></em>
          </Link>
          <button className="agent-action-card" type="button">
            <span><MessageSquareText size={17} /></span>
            <strong>작업자 안내문 저장</strong>
            <p>현장 전달용 문구를 조치 기록에 보관</p>
            <em>저장 <ArrowRight size={13} /></em>
          </button>
        </div>
      </section>
    </div>
  );
}

function AgentEvidencePanel({
  response
}: {
  response: Pick<AskAgentResponse, "sources" | "similarCases"> | null;
}) {
  const sources = response?.sources ?? [];
  const similarCases = response?.similarCases ?? [];

  return (
    <aside className="agent-evidence-card">
      <div className="agent-panel-head">
        <h2><Activity size={18} /> 근거 및 유사 이력</h2>
        <p>Agent 답변에 사용된 기준서와 과거 조치 사례입니다.</p>
      </div>

      <section className="agent-evidence-section">
        <div className="agent-evidence-title">
          <strong>RAG 참조 근거</strong>
          <span>{sources.length}개 문서</span>
        </div>
        {sources.length === 0 ? (
          <div className="empty">질문 후 참조 문서가 표시됩니다.</div>
        ) : (
          <div className="agent-evidence-list">
            {sources.slice(0, 4).map((source, index) => (
              <article className="agent-evidence-source" key={source.id ?? `${source.title}-${index}`}>
                <FileText size={17} />
                <div>
                  <div className="agent-evidence-meta">
                    <span>{documentTypeLabel(source.title)}</span>
                    <em>#{index + 1}</em>
                  </div>
                  <strong>{source.title}</strong>
                  <p>{source.excerpt}</p>
                  <div className="agent-score-bar"><span style={{ width: `${Math.max(6, Math.min(100, source.score * 100))}%` }} /></div>
                </div>
                <em className="agent-score-value">유사도 {source.score.toFixed(2)}</em>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="agent-evidence-section">
        <div className="agent-evidence-title">
          <strong>유사 조치 이력</strong>
          <span>{similarCases.length}건</span>
        </div>
        {similarCases.length === 0 ? (
          <div className="empty">질문 후 유사 이력이 표시됩니다.</div>
        ) : (
          <div className="agent-evidence-list">
            {similarCases.slice(0, 3).map((item) => (
              <article className="agent-evidence-case" key={item.inspectionId}>
                <div>
                  <strong>{item.inspectionId}</strong>
                  <span>{item.equipmentName} · {item.processName}</span>
                </div>
                <p>{item.actionTaken ?? item.note ?? "조치 기록 확인 필요"}</p>
                <footer>
                  {item.defectType ? <span>{item.defectType}</span> : null}
                  <span>유사도 {item.score.toFixed(2)}</span>
                  <span>{reasonLabel(item.reasons[0])}</span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
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

function reasonLabel(reason?: string) {
  return {
    same_defect_type: "동일 불량",
    same_equipment: "동일 설비",
    same_process: "동일 공정",
    similar_lot: "유사 LOT",
    has_action_history: "조치 이력",
    has_reinspection_result: "재검사 이력",
    closed_case: "종결 사례"
  }[reason ?? ""] ?? "유사 조건";
}

function documentTypeLabel(title: string) {
  if (/SOP|기준|기준서/.test(title)) {
    return "기준서";
  }
  if (/가이드|Guide|guide/.test(title)) {
    return "가이드";
  }
  if (/보고|리포트|report/i.test(title)) {
    return "보고서";
  }
  return "문서";
}

function useTypewriter(text: string, intervalMs: number) {
  const [visibleText, setVisibleText] = useState(intervalMs > 0 ? "" : text);

  useEffect(() => {
    if (intervalMs <= 0) {
      setVisibleText(text);
      return;
    }

    setVisibleText("");
    let nextLength = 0;
    const timer = window.setInterval(() => {
      nextLength += 2;
      setVisibleText(text.slice(0, nextLength));
      if (nextLength >= text.length) {
        window.clearInterval(timer);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [text, intervalMs]);

  return visibleText;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return value.slice(0, 16).replace("T", " ");
}
