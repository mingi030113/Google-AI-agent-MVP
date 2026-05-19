"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResultBadge, StatusBadge } from "@/components/ui/badges";
import { client, uploadBase } from "@/features/api/client";
import type { InspectionDetail, InspectionResult } from "@/features/types/api";

export default function InspectionDetailPage() {
  const params = useParams<{ inspectionId: string }>();
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [feedback, setFeedback] = useState({ correctedResult: "", correctedDefectType: "", actionTaken: "", reinspectionResult: "", note: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    client.inspection(params.inspectionId).then((data) => setInspection(data.inspection)).catch((err) => setError(err.message));
  }, [params.inspectionId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await client.feedback(params.inspectionId, {
        correctedResult: feedback.correctedResult as InspectionResult | undefined,
        correctedDefectType: feedback.correctedDefectType || undefined,
        actionTaken: feedback.actionTaken,
        reinspectionResult: feedback.reinspectionResult as InspectionResult | undefined,
        note: feedback.note || undefined
      });
      setInspection(result.inspection);
      setFeedback({ correctedResult: "", correctedDefectType: "", actionTaken: "", reinspectionResult: "", note: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "피드백 저장에 실패했습니다.");
    }
  }

  return (
    <AppShell>
      <PageHeader title="검사 상세" description="AI 판정, 조치 체크리스트, 작업자 피드백을 확인합니다." />
      {error ? <div className="error">{error}</div> : null}
      {!inspection ? (
        <div className="empty">검사 상세를 불러오는 중입니다.</div>
      ) : (
        <div className="grid two">
          <div className="panel grid">
            <h2>{inspection.lotNo}</h2>
            <img className="image-preview" src={uploadBase(inspection.imageUrl)} alt="검사 이미지" />
            <p>{inspection.processName} / {inspection.equipmentName}</p>
            <p><ResultBadge value={inspection.result} /> <StatusBadge value={inspection.status} /></p>
            <p>불량 유형: <strong>{inspection.defectType ?? "-"}</strong></p>
            <p>모델: {inspection.modelName}, 신뢰도 {Math.round(inspection.confidence * 100)}%</p>
          </div>
          <div className="panel">
            <h2>조치 체크리스트</h2>
            {inspection.agentGuidance ? (
              <>
                <p>{inspection.agentGuidance.answer}</p>
                <ul className="checklist">
                  {inspection.agentGuidance.checklist.map((item) => (
                    <li key={item.id}><span>{item.label}</span><span className={`badge ${item.priority}`}>{item.priority}</span></li>
                  ))}
                </ul>
              </>
            ) : <div className="empty">정상 판정에는 조치 체크리스트가 없습니다.</div>}
          </div>
          <form className="panel form" onSubmit={submit}>
            <h2>작업자 피드백</h2>
            <div className="grid two">
              <div className="field">
                <label>수정 판정</label>
                <select className="select" value={feedback.correctedResult} onChange={(event) => setFeedback({ ...feedback, correctedResult: event.target.value })}>
                  <option value="">변경 없음</option>
                  <option value="normal">정상</option>
                  <option value="defective">불량</option>
                </select>
              </div>
              <div className="field">
                <label>재검사 결과</label>
                <select className="select" value={feedback.reinspectionResult} onChange={(event) => setFeedback({ ...feedback, reinspectionResult: event.target.value })}>
                  <option value="">미실시</option>
                  <option value="normal">정상</option>
                  <option value="defective">불량</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>수정 불량 유형</label>
              <input className="input" value={feedback.correctedDefectType} onChange={(event) => setFeedback({ ...feedback, correctedDefectType: event.target.value })} />
            </div>
            <div className="field">
              <label>조치 내용</label>
              <textarea className="textarea" required value={feedback.actionTaken} onChange={(event) => setFeedback({ ...feedback, actionTaken: event.target.value })} />
            </div>
            <div className="field">
              <label>비고</label>
              <textarea className="textarea" value={feedback.note} onChange={(event) => setFeedback({ ...feedback, note: event.target.value })} />
            </div>
            <button className="button">피드백 저장</button>
          </form>
          <div className="panel">
            <h2>기존 피드백</h2>
            {inspection.feedback ? (
              <div className="grid">
                <p>조치: {inspection.feedback.actionTaken}</p>
                <p>재검사: {inspection.feedback.reinspectionResult ?? "-"}</p>
                <p>등록: {inspection.feedback.createdAt}</p>
              </div>
            ) : <div className="empty">등록된 피드백이 없습니다.</div>}
          </div>
        </div>
      )}
    </AppShell>
  );
}
