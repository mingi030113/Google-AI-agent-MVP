"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Save,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LocalizationOverlay } from "@/components/vision/LocalizationOverlay";
import { client, uploadBase } from "@/features/api/client";
import type { InspectionDetail, InspectionFeedback, InspectionResult, VisionLocalization } from "@/features/types/api";

type FeedbackForm = {
  correctedResult: string;
  correctedDefectType: string;
  reinspectionResult: string;
  rootCause: string;
  actionTaken: string;
  note: string;
};

const emptyFeedback: FeedbackForm = {
  correctedResult: "",
  correctedDefectType: "",
  reinspectionResult: "",
  rootCause: "",
  actionTaken: "",
  note: ""
};

const resultLabels: Record<string, string> = {
  normal: "정상",
  suspicious: "의심",
  defective: "불량"
};

const statusLabels: Record<string, string> = {
  pending: "확인 대기",
  reviewed: "확인 완료",
  action_required: "조치 필요",
  closed: "처리 완료"
};

const priorityLabels: Record<string, string> = {
  high: "긴급",
  medium: "점검",
  low: "확인"
};

export default function InspectionDetailPage() {
  const params = useParams<{ inspectionId: string }>();
  const router = useRouter();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [feedback, setFeedback] = useState<FeedbackForm>(emptyFeedback);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState("");
  const [savingChecklistId, setSavingChecklistId] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    client.inspection(params.inspectionId)
      .then((data) => setInspection(data.inspection))
      .catch((err) => setError(err.message));
  }, [params.inspectionId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const note = [feedback.rootCause ? `주요 원인: ${feedback.rootCause}` : "", feedback.note]
        .filter(Boolean)
        .join("\n");
      const result = await client.feedback(params.inspectionId, {
        correctedResult: feedback.correctedResult ? feedback.correctedResult as InspectionResult : undefined,
        correctedDefectType: feedback.correctedDefectType || undefined,
        actionTaken: feedback.actionTaken,
        reinspectionResult: feedback.reinspectionResult ? feedback.reinspectionResult as InspectionResult : undefined,
        note: note || undefined
      });
      setInspection(result.inspection);
      setFeedback(emptyFeedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "피드백 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function createReport() {
    if (!inspection) {
      return;
    }
    setReportMessage("");
    setError("");
    setReportLoading(true);
    try {
      const date = inspection.inspectedAt.slice(0, 10);
      await client.createReport({ reportType: "daily", startDate: date, endDate: date });
      router.push("/reports");
    } catch (err) {
      setError(err instanceof Error ? err.message : "리포트 생성에 실패했습니다.");
    } finally {
      setReportLoading(false);
    }
  }

  async function deleteFeedback(feedbackId: string) {
    setDeletingFeedbackId(feedbackId);
    setError("");
    try {
      const result = await client.deleteFeedback(params.inspectionId, feedbackId);
      setInspection(result.inspection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조치 이력 삭제에 실패했습니다.");
    } finally {
      setDeletingFeedbackId("");
    }
  }

  async function toggleChecklistItem(itemId: string, checked: boolean) {
    setSavingChecklistId(itemId);
    setError("");
    try {
      const result = await client.updateChecklistItem(params.inspectionId, { itemId, checked });
      setInspection(result.inspection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "체크리스트 저장에 실패했습니다.");
    } finally {
      setSavingChecklistId("");
    }
  }

  if (!inspection) {
    return (
      <AppShell>
        {error ? <div className="error">{error}</div> : <div className="empty">검사 상세를 불러오는 중입니다.</div>}
      </AppShell>
    );
  }

  const risk = riskFor(inspection);
  const defectCandidate = inspection.defectType ?? inspection.visionAnalysis?.defectTypeCandidate ?? null;
  const feedbackHistory = inspection.feedbackHistory ?? (inspection.feedback ? [inspection.feedback] : []);
  const sources = inspection.agentGuidance?.sources ?? [];
  const checklist = inspection.agentGuidance?.checklist ?? [];
  const checklistProgress = progressFor(checklist);
  const anomalyEvidence = buildAnomalyEvidence(inspection);

  return (
    <AppShell>
      <div className="detail-titlebar">
        <div>
          <div className="detail-breadcrumb">
            <Link href="/inspections">검사 이력</Link>
            <span>&gt;</span>
            <strong>검사 상세</strong>
          </div>
          <h1>검사 상세</h1>
          <p>AI 판정, 조치 체크리스트, 근거 문서, 작업자 피드백을 확인합니다.</p>
        </div>
        <div className="detail-title-actions">
          <Link className="button secondary" href="/inspections">
            <ArrowLeft size={16} /> 목록으로
          </Link>
          <button className="button" disabled={reportLoading} type="button" onClick={createReport}>
            <FileText size={16} /> {reportLoading ? "리포트 생성 중" : "리포트 생성"}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {reportMessage ? <div className="notice">{reportMessage}</div> : null}

      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-card">
            <div className="detail-card-head">
              <div>
                <h2>검사 결과 요약</h2>
                <p>{inspection.lotNo} · {inspection.processName} / {inspection.equipmentName} · 검사 일시: {formatDateTime(inspection.inspectedAt)}</p>
              </div>
            </div>

            <div className="detail-summary-grid">
              <SummaryBox label="최종 판정" value={resultLabels[inspection.result]} tone={toneForResult(inspection.result)} />
              <SummaryBox label="결함 유형 추정" value={defectCandidate ?? "-"} />
              <SummaryBox label="판정 안정도" value={`${stabilityLabel(inspection.confidence)} (${Math.round(inspection.confidence * 100)}%)`} />
              <SummaryBox label="위험도" value={risk.label} tone={risk.tone} />
              <SummaryBox label="상태" value={statusLabels[inspection.status]} tone={toneForStatus(inspection.status)} />
            </div>

            <div className="detail-image-grid">
              <InspectionImage title="원본 이미지" src={uploadBase(inspection.imageUrl)} />
              <InspectionImage
                title="AI 검출 결과"
                src={uploadBase(inspection.imageUrl)}
                localization={inspection.visionAnalysis?.localization}
                active={Boolean(inspection.visionAnalysis?.localization)}
              />
            </div>

            <div className="detail-meta-line">
              <span>분석 ID: {inspection.id}</span>
              <span>작업자: {inspection.operatorName}</span>
              <span>이상 점수: {formatScore(inspection.visionAnalysis?.anomalyScore)}</span>
              <span>Threshold: {formatScore(inspection.visionAnalysis?.threshold?.image)}</span>
              {anomalyEvidence ? <span>차이: {anomalyEvidence.margin}</span> : null}
              {anomalyEvidence ? <span>기준 대비: {anomalyEvidence.ratio}</span> : null}
            </div>
          </section>

          <form className="detail-card detail-feedback-form" onSubmit={submit}>
            <div className="detail-card-head">
              <div>
                <h2>현장 조치 결과 입력</h2>
                <p>현장 작업자 또는 품질 담당자가 후속 조치 결과를 입력합니다.</p>
              </div>
            </div>

            <div className="detail-form-grid">
              <label>
                <span>조치 상태</span>
                <select value={feedback.correctedResult} onChange={(event) => setFeedback({ ...feedback, correctedResult: event.target.value })}>
                  <option value="">현재 판정 유지</option>
                  <option value="normal">정상으로 정정</option>
                  <option value="defective">불량 유지</option>
                </select>
              </label>
              <label>
                <span>재검사 결과</span>
                <select value={feedback.reinspectionResult} onChange={(event) => setFeedback({ ...feedback, reinspectionResult: event.target.value })}>
                  <option value="">미실시</option>
                  <option value="normal">정상</option>
                  <option value="defective">불량</option>
                </select>
              </label>
              <label>
                <span>주요 원인</span>
                <select value={feedback.rootCause} onChange={(event) => setFeedback({ ...feedback, rootCause: event.target.value })}>
                  <option value="">선택</option>
                  <option value="지그/접촉면 마모">지그/접촉면 마모</option>
                  <option value="이송 레일 오염">이송 레일 오염</option>
                  <option value="작업대 이물">작업대 이물</option>
                  <option value="설비 조건 편차">설비 조건 편차</option>
                </select>
              </label>
            </div>

            <label className="detail-field">
              <span>조치 담당자</span>
              <input value={inspection.operatorName} readOnly />
            </label>
            <label className="detail-field">
              <span>수정 불량 유형</span>
              <input value={feedback.correctedDefectType} onChange={(event) => setFeedback({ ...feedback, correctedDefectType: event.target.value })} placeholder={inspection.defectType ?? "불량 유형"} />
            </label>
            <label className="detail-field">
              <span>조치 내용</span>
              <textarea required value={feedback.actionTaken} onChange={(event) => setFeedback({ ...feedback, actionTaken: event.target.value })} placeholder="조치 내용과 재발 방지 조치를 입력하세요." />
            </label>
            <label className="detail-field">
              <span>비고</span>
              <textarea value={feedback.note} onChange={(event) => setFeedback({ ...feedback, note: event.target.value })} placeholder="추가로 전달할 사항이 있으면 입력하세요." />
            </label>

            <div className="detail-form-actions">
              <button className="button" disabled={saving || !feedback.actionTaken.trim()}>
                <Save size={16} /> {saving ? "저장 중" : "피드백 저장"}
              </button>
            </div>
          </form>
        </div>

        <aside className="detail-side">
          <section className="detail-card detail-agent-card">
            <div className="detail-card-head">
              <div>
                <h2>RAG Agent 조치 체크리스트</h2>
                <p>기준서 기반 Agent 제안 · {checklistProgress.completed}/{checklistProgress.total} 완료</p>
              </div>
              <span className={`detail-risk-chip ${risk.tone}`}>
                <ShieldAlert size={14} /> 우선순위: {risk.label}
              </span>
            </div>

            {inspection.agentGuidance ? (
              <>
                <p className="detail-agent-answer">{inspection.agentGuidance.answer}</p>
                <div className="detail-checklist-progress" aria-label="체크리스트 진행률">
                  <span style={{ width: `${checklistProgress.percent}%` }} />
                </div>
                <ul className="detail-checklist">
                  {checklist.map((item) => (
                    <li key={item.id}>
                      <input
                        type="checkbox"
                        checked={Boolean(item.checked)}
                        disabled={savingChecklistId === item.id}
                        onChange={(event) => toggleChecklistItem(item.id, event.target.checked)}
                        aria-label={item.label}
                      />
                      <span>{item.label}</span>
                      <em className={item.priority}>{priorityLabels[item.priority]}</em>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="empty">등록된 Agent 체크리스트가 없습니다.</div>
            )}
          </section>

          <section className="detail-card">
            <div className="detail-card-head">
              <h2>RAG 참조 근거</h2>
            </div>
            {sources.length === 0 ? (
              <div className="empty">표시할 참조 근거가 없습니다.</div>
            ) : (
              <div className="detail-source-list">
                {sources.map((source, index) => (
                  <article key={source.id ?? `${source.title}-${index}`}>
                    <FileText size={16} />
                    <div>
                      <strong>{source.title}</strong>
                      <p>{source.excerpt}</p>
                    </div>
                    <span>유사도 {source.score.toFixed(2)}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="detail-card">
            <div className="detail-card-head">
              <h2>기존 피드백 / 조치 이력</h2>
            </div>
            {feedbackHistory.length === 0 ? (
              <div className="empty">등록된 피드백이 없습니다.</div>
            ) : (
              <div className="detail-history-list">
                {feedbackHistory.map((item, index) => (
                  <FeedbackHistoryItem
                    deleting={deletingFeedbackId === feedbackKey(item)}
                    item={item}
                    key={item.id ?? `${item.createdAt}-${index}`}
                    onDelete={() => deleteFeedback(feedbackKey(item))}
                  />
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function SummaryBox({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "red" | "green" | "amber" | "neutral" }) {
  return (
    <div className={`detail-summary-box ${tone}`}>
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function InspectionImage({
  title,
  src,
  localization,
  active = false
}: {
  title: string;
  src: string;
  localization?: VisionLocalization | null;
  active?: boolean;
}) {
  return (
    <figure className="detail-image-box">
      <figcaption><ImageIcon size={14} /> {title}</figcaption>
      <div>
        <LocalizationOverlay src={src} alt={title} localization={localization} active={active && Boolean(localization)} />
      </div>
    </figure>
  );
}

function FeedbackHistoryItem({
  deleting,
  item,
  onDelete
}: {
  deleting: boolean;
  item: InspectionFeedback;
  onDelete: () => void;
}) {
  return (
    <article className="detail-history-item">
      <CheckCircle2 size={16} />
      <div>
        <strong>{formatDateTime(item.createdAt)}</strong>
        <p>{item.actionTaken}</p>
        <span>
          재검사 {item.reinspectionResult ? resultLabels[item.reinspectionResult] : "-"}
          {item.correctedResult ? ` · 정정 ${resultLabels[item.correctedResult]}` : ""}
        </span>
        {item.note ? <small>{item.note}</small> : null}
      </div>
      <button className="detail-history-delete" disabled={deleting} onClick={onDelete} type="button">
        <Trash2 size={13} /> {deleting ? "삭제 중" : "삭제"}
      </button>
    </article>
  );
}

function feedbackKey(item: InspectionFeedback) {
  return item.id ?? item.createdAt;
}

function progressFor(checklist: Array<{ checked?: boolean }>) {
  const total = checklist.length;
  const completed = checklist.filter((item) => item.checked).length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100)
  };
}

function riskFor(inspection: InspectionDetail): { label: string; tone: "red" | "amber" | "green" } {
  if (inspection.status === "action_required" || (inspection.result === "defective" && inspection.confidence >= 0.9)) {
    return { label: "High Risk", tone: "red" };
  }
  if (inspection.result === "defective" || inspection.result === "suspicious") {
    return { label: "Medium Risk", tone: "amber" };
  }
  return { label: "Low Risk", tone: "green" };
}

function toneForResult(result: InspectionResult): "red" | "green" | "amber" {
  if (result === "defective") {
    return "red";
  }
  if (result === "suspicious") {
    return "amber";
  }
  return "green";
}

function toneForStatus(status: string): "red" | "green" | "amber" {
  if (status === "action_required") {
    return "red";
  }
  if (status === "pending") {
    return "amber";
  }
  return "green";
}

function buildAnomalyEvidence(inspection: InspectionDetail) {
  const score = inspection.visionAnalysis?.anomalyScore;
  const threshold = inspection.visionAnalysis?.threshold?.image;

  if (typeof score !== "number" || typeof threshold !== "number" || !Number.isFinite(score) || !Number.isFinite(threshold) || threshold <= 0) {
    return null;
  }

  return {
    margin: formatSignedScore(score - threshold),
    ratio: `${(score / threshold).toFixed(2)}x`
  };
}

function stabilityLabel(confidence: number) {
  if (confidence >= 0.9) {
    return "높음";
  }
  if (confidence >= 0.6) {
    return "보통";
  }
  return "낮음";
}

function formatScore(value: number | undefined) {
  return Number.isFinite(value) ? Number(value).toFixed(3) : "-";
}

function formatSignedScore(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function formatDateTime(value: string) {
  return value.slice(0, 16).replace("T", " ");
}
