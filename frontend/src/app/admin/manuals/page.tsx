"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { client } from "@/features/api/client";
import type { Manual } from "@/features/types/api";

export default function ManualsPage() {
  const [manuals, setManuals] = useState<Manual[]>([]);
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
    client.manuals().then((data) => setManuals(data.items)).catch((err) => setError(err.message));
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
      setManuals((current) => current.filter((item) => item.id !== manual.id));
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
      <div className="grid two">
        <form className="panel form" onSubmit={handleUpload}>
          <div className="panel-header">
            <div>
              <h2>매뉴얼 업로드</h2>
              <p className="panel-subtitle">텍스트 기준서를 등록하면 Agent 검색 출처로 반영됩니다.</p>
            </div>
          </div>
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
          <div className="field">
            <label>체크리스트</label>
            <textarea
              className="textarea"
              value={checklist}
              onChange={(event) => setChecklist(event.target.value)}
              placeholder="- 지그 접촉면 마모 확인&#10;- 이송 레일 청소&#10;- 동일 LOT 재검사"
            />
          </div>
          <div className="field">
            <label>파일</label>
            <input
              className="input"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <button className="button" disabled={uploading}>{uploading ? "업로드 중" : "업로드"}</button>
          <div className="empty">현재 백엔드는 텍스트와 마크다운 파일을 RAG chunk로 변환합니다.</div>
        </form>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>기준서 목록</h2>
              <p className="panel-subtitle">삭제한 기준서는 Agent 검색 대상에서 제외됩니다.</p>
            </div>
          </div>
          {manuals.length === 0 ? <div className="empty">기준서를 불러오는 중입니다.</div> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>기준서</th>
                    <th>유형</th>
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {manuals.map((manual) => (
                    <tr key={manual.id}>
                      <td>
                        <strong>{manual.title}</strong>
                        <p className="manual-excerpt">{manual.excerpt}</p>
                      </td>
                      <td>{manual.defectType ?? "-"}</td>
                      <td><span className="badge low">{manual.embeddingStatus ?? "completed"}</span></td>
                      <td>
                        <button
                          className="button danger"
                          disabled={deletingId === manual.id}
                          onClick={() => deleteManual(manual)}
                          title="기준서 삭제"
                          type="button"
                        >
                          <Trash2 size={16} /> {deletingId === manual.id ? "삭제 중" : "삭제"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
