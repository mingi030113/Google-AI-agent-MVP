"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  FileUp,
  Layers3,
  SearchCheck,
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { client } from "@/features/api/client";
import type { Manual } from "@/features/types/api";

export default function ManualsPage() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [selectedManual, setSelectedManual] = useState<Manual | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [defectType, setDefectType] = useState("scratch");
  const [checklist, setChecklist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    loadManuals();
  }, []);

  function loadManuals() {
    client.manuals().then((data) => {
      setManuals(data.items);
      setSelectedManual((current) => data.items.find((item) => item.id === current?.id) ?? data.items[0] ?? null);
    }).catch((err) => setError(err.message));
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");

    if (!file) {
      setError("업로드할 매뉴얼 파일을 선택해 주세요.");
      return;
    }

    if (!title.trim()) {
      setError("기준서명을 입력해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("defectType", defectType);
    formData.append("checklist", checklist.trim());
    formData.append("file", file);

    try {
      setUploading(true);
      const result = await client.uploadManual(formData);
      setManuals((current) => [result.manual, ...current.filter((manual) => manual.id !== result.manual.id)]);
      setSelectedManual(result.manual);
      setMessage(`${result.manual.title} 업로드 완료: ${result.chunks.length}개 chunk 생성`);
      setTitle("");
      setChecklist("");
      setFile(null);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "매뉴얼 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteManual(manual: Manual) {
    if (!window.confirm(`${manual.title} 기준서를 삭제할까요? Agent 검색 출처에서도 제외됩니다.`)) {
      return;
    }

    setError("");
    setMessage("");
    setDeletingId(manual.id);
    try {
      await client.deleteManual(manual.id);
      setManuals((current) => {
        const next = current.filter((item) => item.id !== manual.id);
        setSelectedManual((selected) => selected?.id === manual.id ? next[0] ?? null : selected);
        return next;
      });
      setMessage(`${manual.title} 삭제 완료`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "기준서 삭제에 실패했습니다.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <AppShell>
      <PageHeader title="매뉴얼 관리" description="Agent가 참조할 품질 기준서를 업로드하고 검색 상태를 확인합니다." />
      {error ? <div className="error">{error}</div> : null}
      {message ? <div className="notice">{message}</div> : null}

      <div className="manual-workspace">
        <section className="manual-kpi-grid">
          <div className="manual-kpi-card">
            <span><BookOpen size={17} /> 등록 기준서</span>
            <strong>{manuals.length}개</strong>
            <p>Agent 답변에 참조 가능한 문서</p>
          </div>
          <div className="manual-kpi-card">
            <span><Database size={17} /> 임베딩 완료</span>
            <strong>{manuals.filter((manual) => (manual.embeddingStatus ?? "completed") === "completed").length}개</strong>
            <p>검색 인덱스 반영 상태</p>
          </div>
          <div className="manual-kpi-card">
            <span><Layers3 size={17} /> 체크리스트</span>
            <strong>{manuals.reduce((sum, manual) => sum + manual.checklist.length, 0)}개</strong>
            <p>조치 Agent가 재사용할 항목</p>
          </div>
        </section>

        <div className="manual-layout">
          <form className="manual-upload-panel" onSubmit={handleUpload}>
            <div className="panel-header">
              <div>
                <h2><FileUp size={18} /> 매뉴얼 업로드</h2>
                <p className="panel-subtitle">텍스트 기준서를 등록하면 RAG 검색 출처로 반영됩니다.</p>
              </div>
            </div>

            <div className="manual-dropzone">
              <FileText size={28} />
              <strong>{file ? file.name : "텍스트 또는 마크다운 기준서 선택"}</strong>
              <p>업로드 후 문서 chunk와 embedding 상태가 기준서 목록에 반영됩니다.</p>
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <div className="manual-form-grid">
              <div className="field">
                <label>기준서명</label>
                <input
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 스크래치 불량 조치 기준서"
                />
              </div>
              <div className="field">
                <label>불량 유형</label>
                <select className="select" value={defectType} onChange={(event) => setDefectType(event.target.value)}>
                  <option value="scratch">scratch</option>
                  <option value="contamination">contamination</option>
                  <option value="dent">dent</option>
                  <option value="crack">crack</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>체크리스트</label>
              <textarea
                className="textarea"
                value={checklist}
                onChange={(event) => setChecklist(event.target.value)}
                placeholder="- 지그 접촉면 마모 확인&#10;- 이송 레일 청소&#10;- 동일 LOT 재검사"
              />
            </div>

            <div className="manual-ingest-flow">
              <span><Clock3 size={14} /> 파일 수집</span>
              <span><Layers3 size={14} /> chunk 생성</span>
              <span><SearchCheck size={14} /> RAG 검색 반영</span>
            </div>
            <button className="button" disabled={uploading}>{uploading ? "업로드 중" : "업로드"}</button>
          </form>

          <section className="manual-library-panel">
            <div className="panel-header">
              <div>
                <h2><BookOpen size={18} /> 기준서 라이브러리</h2>
                <p className="panel-subtitle">삭제한 기준서는 Agent 검색 대상에서 제외됩니다.</p>
              </div>
            </div>
            {manuals.length === 0 ? <div className="empty">기준서를 불러오는 중입니다.</div> : (
              <div className="manual-library-grid">
                <div className="manual-list">
                  {manuals.map((manual) => (
                    <article className={`manual-list-item ${selectedManual?.id === manual.id ? "active" : ""}`} key={manual.id}>
                      <button type="button" onClick={() => setSelectedManual(manual)}>
                        <span>{manual.defectType ?? "general"}</span>
                        <strong>{manual.title}</strong>
                        <p>{manual.excerpt}</p>
                      </button>
                      <div className="manual-list-meta">
                        <em className={`manual-status ${manual.embeddingStatus ?? "completed"}`}>
                          <CheckCircle2 size={13} /> {statusLabel(manual.embeddingStatus)}
                        </em>
                        <button
                          disabled={deletingId === manual.id}
                          onClick={() => deleteManual(manual)}
                          title="기준서 삭제"
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <aside className="manual-detail-panel">
                  {!selectedManual ? (
                    <div className="empty">기준서를 선택하세요.</div>
                  ) : (
                    <>
                      <div className="manual-detail-head">
                        <span>{selectedManual.defectType ?? "general"}</span>
                        <h3>{selectedManual.title}</h3>
                        <p>{selectedManual.excerpt}</p>
                      </div>
                      <div className="manual-detail-stats">
                        <span>상태 <strong>{statusLabel(selectedManual.embeddingStatus)}</strong></span>
                        <span>등록일 <strong>{selectedManual.createdAt ? formatDate(selectedManual.createdAt) : "-"}</strong></span>
                      </div>
                      <div className="manual-checklist-preview">
                        <h4>조치 체크리스트</h4>
                        {selectedManual.checklist.length === 0 ? (
                          <p>등록된 체크리스트가 없습니다.</p>
                        ) : (
                          selectedManual.checklist.map((item) => (
                            <div key={item.id}>
                              <span className={`manual-priority ${item.priority}`}>{priorityLabel(item.priority)}</span>
                              <p>{item.label}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </aside>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function statusLabel(status: Manual["embeddingStatus"]) {
  if (status === "pending") return "대기";
  if (status === "processing") return "처리 중";
  if (status === "failed") return "실패";
  return "완료";
}

function priorityLabel(priority: "low" | "medium" | "high") {
  if (priority === "high") return "긴급";
  if (priority === "medium") return "점검";
  return "일반";
}

function formatDate(value: string) {
  return value.slice(0, 10);
}
