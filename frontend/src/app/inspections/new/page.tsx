"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckSquare,
  Cpu,
  FileImage,
  FileSearch,
  FileText,
  ImageIcon,
  LocateFixed,
  ScanLine,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { client } from "@/features/api/client";
import type { AgentGuidance, InspectionDetail, MasterData } from "@/features/types/api";

type StageKey = "ready" | "upload" | "vision" | "rag" | "done" | "error";

const stages: Array<{ key: StageKey; title: string; icon: typeof ImageIcon }> = [
  { key: "upload", title: "이미지 수집", icon: ImageIcon },
  { key: "vision", title: "결함 영역 탐지", icon: LocateFixed },
  { key: "rag", title: "표준서 검색", icon: FileSearch },
  { key: "done", title: "조치 가이드 생성", icon: CheckSquare }
];

const defectLabels: Record<string, string> = {
  scratch: "스크래치",
  contamination: "오염",
  dent: "찍힘",
  crack: "크랙"
};

const defectOrder = ["crack", "scratch", "contamination", "dent"];

const reasonLabels: Record<string, string> = {
  crack: "충격 흔적",
  scratch: "레일 접촉",
  contamination: "표면 오염",
  dent: "압입 흔적"
};

const agentHandoffKey = "quality-agent-inspection-handoff";

export default function NewInspectionPage() {
  const router = useRouter();
  const [master, setMaster] = useState<MasterData | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({ processId: "", equipmentId: "", lotNo: "LOT-20260518-001", memo: "" });
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [stage, setStage] = useState<StageKey>("ready");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    client.masterData().then((data) => {
      setMaster(data);
      setForm((current) => ({
        ...current,
        processId: data.processes[0]?.id ?? "",
        equipmentId: data.equipment[0]?.id ?? ""
      }));
    }).catch((err) => setError(err.message));
  }, []);

  const equipment = useMemo(
    () => master?.equipment.filter((item) => item.processId === form.processId) ?? [],
    [master, form.processId]
  );

  const defectName = inspection?.defectType ? defectLabels[inspection.defectType] ?? inspection.defectType : "-";
  const confidence = inspection ? `${Math.round(inspection.confidence * 100)}%` : "-";
  const decision = inspection ? (inspection.result === "defective" ? "불량 감지" : "정상") : "-";
  const risk = inspection ? (inspection.result === "defective" ? "High" : "Low") : "-";
  const defectScores = buildDefectScores(inspection);
  const selectedProcess = master?.processes.find((item) => item.id === form.processId);
  const selectedEquipment = master?.equipment.find((item) => item.id === form.equipmentId);
  const requestReady = Boolean(image && form.processId && form.equipmentId && form.lotNo);
  const hasDefect = inspection?.result === "defective";
  const DecisionIcon = inspection?.result === "defective" ? AlertTriangle : ShieldCheck;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!image) {
      setError("검사 이미지를 먼저 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setInspection(null);

    const body = new FormData();
    body.append("image", image);
    body.append("processId", form.processId);
    body.append("equipmentId", form.equipmentId);
    body.append("lotNo", form.lotNo);
    body.append("memo", form.memo);

    try {
      const [result] = await Promise.all([client.analyze(body), runStageSequence(setStage)]);
      setInspection(result.inspection);
      setStage("done");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "검사 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function sendToAgent() {
    if (!inspection) {
      return;
    }

    window.sessionStorage.setItem(agentHandoffKey, JSON.stringify(inspection));
    router.push(`/agent?inspectionId=${encodeURIComponent(inspection.id)}`);
  }

  return (
    <AppShell>
      <header className="inspection-title">
        <div>
          <span className="inspection-title-kicker"><Cpu size={15} /> Vision · RAG 검사 콘솔</span>
          <h1>AI 품질 검사</h1>
          <p>Vision AI가 불량을 판정하고, RAG Agent가 표준서 기반 조치 가이드를 제공합니다.</p>
        </div>
        <div className="inspection-title-status">
          <span><strong>{selectedProcess?.name ?? "-"}</strong><small>공정</small></span>
          <span><strong>{selectedEquipment?.name ?? "-"}</strong><small>설비</small></span>
          <span className={requestReady ? "ready" : ""}><strong>{requestReady ? "Ready" : "Standby"}</strong><small>검사 상태</small></span>
        </div>
      </header>

      <div className="inspection-workspace">
        <form className="panel inspection-request-card" onSubmit={submit}>
          <div className="inspection-card-head">
            <div>
              <span><Activity size={15} /> 검사 요청</span>
              <h2>이미지 및 생산 정보</h2>
            </div>
          </div>

          <label className={`inspection-dropzone ${preview ? "has-image" : ""}`}>
            {preview ? <img src={preview} alt="" aria-hidden="true" /> : null}
            <div className="inspection-dropzone-copy">
              <UploadCloud size={42} />
              <strong>{image ? image.name : "검사 이미지를 드래그하거나 클릭하여 업로드"}</strong>
              <span>{image ? "이미지 선택 완료 · 분석 실행 가능" : "PNG, JPG, WEBP 지원 · 최대 10MB"}</span>
              <em>{image ? "Replace image" : "Select image"}</em>
            </div>
            <input type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImage(file);
              setPreview(file ? URL.createObjectURL(file) : "");
              setInspection(null);
              setStage("ready");
            }} />
          </label>

          <section className="inspection-vision-panel">
            <div className="inspection-vision-head">
              <span><ScanLine size={15} /> Vision Workspace</span>
              <strong>{inspection ? hasDefect ? "결함 영역 표시 완료" : "결함 없음 확인" : image ? "분석 대기 중" : "이미지 입력 대기"}</strong>
            </div>
            <div className="inspection-image-row">
              <PreviewBox title="원본 이미지" src={preview} emptyText="이미지 업로드 시 원본이 표시됩니다." />
              <div className="inspection-arrow">
                <ScanLine size={18} />
                <span>AI Scan</span>
              </div>
              <PreviewBox
                title="AI 검출 결과"
                src={preview}
                detected={hasDefect}
                status={inspection ? hasDefect ? "Defect marked" : "No defect" : undefined}
                emptyText="분석 실행 시 검출 결과가 표시됩니다."
              />
            </div>
          </section>

          <div className="grid two">
            <div className="field">
              <label>공정</label>
              <select className="select" value={form.processId} onChange={(event) => {
                const processId = event.target.value;
                const firstEquipment = master?.equipment.find((item) => item.processId === processId)?.id ?? "";
                setForm({ ...form, processId, equipmentId: firstEquipment });
              }}>
                {master?.processes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>설비</label>
              <select className="select" value={form.equipmentId} onChange={(event) => setForm({ ...form, equipmentId: event.target.value })}>
                {equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid two">
            <div className="field">
              <label>LOT</label>
              <input className="input" required value={form.lotNo} onChange={(event) => setForm({ ...form, lotNo: event.target.value })} />
            </div>
            <div className="field">
              <label>메모 (선택)</label>
              <input className="input" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="메모를 입력하세요." />
            </div>
          </div>

          {error ? <div className="error">{error}</div> : null}
          <button className="button inspection-submit" disabled={loading || !image} type="submit">
            <Sparkles size={19} /> {loading ? "AI 판정 및 조치 가이드 생성 중" : "AI 판정 및 조치 가이드 생성"}
          </button>
        </form>

        <section className="inspection-result-stack">
          <div className="panel inspection-stage-card">
            <div className="inspection-stage-head">
              <div>
                <span><Sparkles size={15} /> AI Pipeline</span>
                <h2>{inspection ? "AI 분석 결과" : loading ? "AI 분석 진행 중" : "AI 분석 대기 중"}</h2>
                <p>이미지를 업로드하고 검사 정보를 입력하면 Vision AI 판정과 RAG 기반 조치 가이드가 생성됩니다.</p>
              </div>
              <strong className={loading ? "active" : inspection ? "complete" : ""}>{loading ? "Running" : inspection ? "Complete" : "Idle"}</strong>
            </div>
            <div className="inspection-stage-line">
              {stages.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div className={`inspection-stage ${stageClass(stage, item.key)}`} key={item.key}>
                    <span>{index + 1}</span>
                    <Icon size={24} />
                    <strong>{item.title}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          {inspection ? (
            <div className={`panel inspection-decision-card ${inspection.result}`}>
              <div className="inspection-decision-grid">
                <div className="inspection-final-decision">
                  <span>최종 판정</span>
                  <strong><DecisionIcon size={22} /> {decision}</strong>
                </div>
                <ResultMetric label="불량 유형" value={defectName} />
                <ResultMetric label="신뢰도" value={confidence} />
                <ResultMetric label="위험도" value={risk} />
              </div>
              <div className="inspection-decision-meta">
                <span><FileText size={14} /> LOT {form.lotNo}</span>
                <span><LocateFixed size={14} /> 공정 {master?.processes.find((item) => item.id === form.processId)?.name ?? "-"}</span>
                <span><ShieldCheck size={14} /> 설비 {master?.equipment.find((item) => item.id === form.equipmentId)?.name ?? "-"}</span>
                <span>{inspection.inspectedAt.slice(0, 19).replace("T", " ")}</span>
              </div>
            </div>
          ) : (
            <div className="panel inspection-summary-card inspection-readiness-card">
              <div className="inspection-readiness-head">
                <span><ShieldCheck size={16} /> 검사 준비 상태</span>
                <strong>{requestReady ? "분석 실행 가능" : "입력값 확인 필요"}</strong>
              </div>
              <div className="inspection-summary-grid">
                <SummaryItem icon={FileImage} label="이미지" value={image ? "선택됨" : "대기"} active={Boolean(image)} />
                <SummaryItem icon={LocateFixed} label="공정" value={selectedProcess?.name ?? "-"} active={Boolean(form.processId)} />
                <SummaryItem icon={ShieldCheck} label="설비" value={selectedEquipment?.name ?? "-"} active={Boolean(form.equipmentId)} />
                <SummaryItem icon={Sparkles} label="Agent" value={requestReady ? "준비됨" : "대기"} active={requestReady} />
              </div>
            </div>
          )}

          {inspection ? (
            <div className="inspection-analysis-grid">
              {hasDefect ? (
                <div className="panel inspection-defect-card">
                  <h2>결함 유형 신뢰도</h2>
                  <div className="inspection-defect-list">
                    {defectScores.map((item) => (
                      <div className="inspection-defect-row" key={item.type}>
                        <span>{item.label}</span>
                        <div><i style={{ width: `${item.percent}%` }} /></div>
                        <strong>{item.percent}%</strong>
                      </div>
                    ))}
                  </div>
                  <h3>예상 원인</h3>
                  <div className="inspection-cause-tags">
                    {defectScores.slice(0, 3).map((item) => <span key={item.type}>{reasonLabels[item.type] ?? item.label}</span>)}
                  </div>
                </div>
              ) : (
                <div className="panel inspection-clear-card">
                  <ShieldCheck size={28} />
                  <h2>검출 불량 없음</h2>
                  <p>Vision AI 분석 결과 결함 영역이 확인되지 않았습니다. LOT와 설비 정보만 기록하고 필요 시 조치 가이드에서 표준 확인 절차를 검토하세요.</p>
                  <div>
                    <span>Normal</span>
                    <strong>{confidence}</strong>
                    <em>판정 신뢰도</em>
                  </div>
                </div>
              )}
              <div className="panel inspection-guide-card result">
                <h2>RAG Agent 조치 가이드</h2>
                {inspection.agentGuidance ? <GuidePreview guidance={inspection.agentGuidance} withPriority /> : <GuideSkeleton />}
              </div>
            </div>
          ) : (
            <div className="panel inspection-guide-card">
              <h2>RAG Agent 조치 가이드</h2>
              <GuideSkeleton />
            </div>
          )}

          <div className="panel inspection-sources-card">
            <h2>RAG 검색 근거</h2>
            <div className="inspection-source-grid">
              {inspection?.agentGuidance?.sources?.length
                ? inspection.agentGuidance.sources.slice(0, 3).map((source, index) => (
                  <div className="inspection-source" key={source.id ?? `${source.title}-${index}`}>
                    <FileSearch size={20} />
                    <strong>{source.title}</strong>
                    <p>{source.excerpt}</p>
                  </div>
                ))
                : [0, 1, 2].map((item) => (
                  <div className="inspection-source skeleton" key={item}>
                    <FileSearch size={20} />
                    <strong />
                    <p />
                  </div>
                ))}
            </div>
          </div>

          {inspection ? (
            <div className="inspection-action-row">
              <button className="button" onClick={sendToAgent} type="button">
                <Send size={17} /> 조치 Agent로 전달
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function PreviewBox({ title, src, detected, status, emptyText }: { title: string; src: string; detected?: boolean; status?: string; emptyText: string }) {
  return (
    <div className="inspection-preview-box">
      <div className="inspection-preview-title">
        <strong>{title}</strong>
        <span>{status ?? (detected ? "Defect marked" : src ? "Image loaded" : "Waiting")}</span>
      </div>
      <div className={`inspection-preview-image ${detected ? "detected" : ""}`}>
        {src ? (
          <>
            <img src={src} alt={title} />
            {detected ? <><i /><em>AI DETECTED</em></> : null}
          </>
        ) : (
          <span>
            <ImageIcon size={35} />
            {emptyText}
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, active = false }: { icon: typeof ShieldCheck; label: string; value: string; active?: boolean }) {
  return (
    <div className={`inspection-summary-item ${active ? "active" : ""}`}>
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="inspection-result-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GuidePreview({ guidance, withPriority = false }: { guidance: AgentGuidance; withPriority?: boolean }) {
  return (
    <ol className="inspection-guide-list">
      {guidance.checklist.slice(0, withPriority ? 5 : 3).map((item, index) => (
        <li key={item.id}>
          <span>{index + 1}</span>
          <p>{item.label}</p>
          {withPriority ? <em className={`badge ${item.priority}`}>{priorityLabel(item.priority)}</em> : null}
        </li>
      ))}
    </ol>
  );
}

function GuideSkeleton() {
  return (
    <ol className="inspection-guide-list skeleton">
      {[1, 2, 3].map((item) => (
        <li key={item}>
          <span>{item}</span>
          <p />
        </li>
      ))}
    </ol>
  );
}

async function runStageSequence(setStage: (stage: StageKey) => void) {
  setStage("upload");
  await delay(420);
  setStage("vision");
  await delay(720);
  setStage("rag");
  await delay(600);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stageClass(current: StageKey, target: StageKey) {
  const order = ["upload", "vision", "rag", "done"];
  const currentIndex = order.indexOf(current);
  const targetIndex = order.indexOf(target);
  if (current === "error") {
    return "error";
  }
  if (current === target) {
    return "active";
  }
  if (currentIndex > targetIndex || current === "done") {
    return "complete";
  }
  return "";
}

function buildDefectScores(inspection: InspectionDetail | null) {
  if (!inspection || inspection.result !== "defective") {
    return [];
  }

  const scores = inspection.visionAnalysis?.defectScores ?? {};
  const fallbackConfidence = inspection.result === "defective" ? inspection.confidence : 0.08;
  const rows = defectOrder.map((type, index) => {
    const fallback = type === inspection.defectType
      ? fallbackConfidence
      : Math.max(0.05, fallbackConfidence * [0.32, 0.22, 0.14][index % 3]);
    const value = Number(scores[type] ?? fallback);
    return {
      type,
      label: `${defectLabels[type] ?? type} (${type})`,
      percent: Math.round(Math.min(Math.max(value, 0), 1) * 100)
    };
  });

  return rows.sort((left, right) => right.percent - left.percent);
}

function priorityLabel(priority: "low" | "medium" | "high") {
  return { low: "확인", medium: "점검", high: "긴급" }[priority];
}
