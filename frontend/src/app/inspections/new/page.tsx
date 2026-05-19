"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResultBadge, StatusBadge } from "@/components/ui/badges";
import { client, uploadBase } from "@/features/api/client";
import type { InspectionDetail, MasterData } from "@/features/types/api";

export default function NewInspectionPage() {
  const [master, setMaster] = useState<MasterData | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({ processId: "", equipmentId: "", lotNo: "", memo: "" });
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    client.masterData().then((data) => {
      setMaster(data);
      setForm((current) => ({ ...current, processId: data.processes[0]?.id ?? "", equipmentId: data.equipment[0]?.id ?? "" }));
    }).catch((err) => setError(err.message));
  }, []);

  const equipment = useMemo(
    () => master?.equipment.filter((item) => item.processId === form.processId) ?? [],
    [master, form.processId]
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!image) {
      setError("image file is required.");
      return;
    }
    setLoading(true);
    setError("");
    const body = new FormData();
    body.append("image", image);
    body.append("processId", form.processId);
    body.append("equipmentId", form.equipmentId);
    body.append("lotNo", form.lotNo);
    body.append("memo", form.memo);
    try {
      const result = await client.analyze(body);
      setInspection(result.inspection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검사 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="새 검사" description="이미지를 업로드하고 공정 정보를 입력해 AI 판정을 요청합니다." />
      <div className="grid two">
        <form className="panel form" onSubmit={submit}>
          <div className="field">
            <label>이미지</label>
            <input className="input" type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImage(file);
              setPreview(file ? URL.createObjectURL(file) : "");
            }} />
          </div>
          {preview ? <img className="image-preview" src={preview} alt="선택 이미지 미리보기" /> : <div className="empty">이미지를 선택하세요.</div>}
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
          <div className="field">
            <label>LOT</label>
            <input className="input" required value={form.lotNo} onChange={(event) => setForm({ ...form, lotNo: event.target.value })} placeholder="LOT-20260518-001" />
          </div>
          <div className="field">
            <label>메모</label>
            <textarea className="textarea" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
          </div>
          {error ? <div className="error">{error}</div> : null}
          <button className="button" disabled={loading}>{loading ? "분석 중" : "검사 요청"}</button>
        </form>
        <div className="panel">
          <h2>검사 결과</h2>
          {!inspection ? (
            <div className="empty">분석이 완료되면 판정 결과와 조치 가이드가 표시됩니다.</div>
          ) : (
            <div className="grid">
              <img className="image-preview" src={uploadBase(inspection.imageUrl)} alt="분석 이미지" />
              <p><ResultBadge value={inspection.result} /> <StatusBadge value={inspection.status} /></p>
              <p>불량 유형: <strong>{inspection.defectType ?? "-"}</strong></p>
              <p>신뢰도: <strong>{Math.round(inspection.confidence * 100)}%</strong></p>
              {inspection.agentGuidance ? <p>{inspection.agentGuidance.answer}</p> : null}
              <Link className="button secondary" href={`/inspections/${inspection.id}`}>상세 보기</Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
