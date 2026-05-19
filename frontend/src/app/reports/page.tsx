"use client";

import { useEffect, useState } from "react";
import { FilePlus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { client } from "@/features/api/client";
import type { QualityReport } from "@/features/types/api";

export default function ReportsPage() {
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [selected, setSelected] = useState<QualityReport | null>(null);
  const [form, setForm] = useState({ reportType: "daily" as "daily" | "weekly", startDate: "2026-05-12", endDate: "2026-05-18" });
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  function load() {
    client.reports().then((data) => {
      setReports(data.items);
      setSelected(data.items[0] ?? null);
    }).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await client.createReport(form);
      setReports((items) => [result.report, ...items]);
      setSelected(result.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "리포트 생성에 실패했습니다.");
    }
  }

  async function deleteReport(report: QualityReport) {
    if (!window.confirm(`${report.title} 리포트를 삭제할까요?`)) {
      return;
    }

    setError("");
    setDeletingId(report.id);
    try {
      await client.deleteReport(report.id);
      const next = reports.filter((item) => item.id !== report.id);
      setReports(next);
      setSelected((current) => current?.id === report.id ? next[0] ?? null : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "리포트 삭제에 실패했습니다.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <AppShell>
      <PageHeader title="리포트" description="기간별 품질 리포트를 생성하고 권장 조치를 확인합니다." />
      {error ? <div className="error">{error}</div> : null}
      <div className="grid two">
        <div className="panel">
          <form className="form" onSubmit={submit}>
            <div className="panel-header">
              <div>
                <h2>리포트 생성</h2>
                <p className="panel-subtitle">기간을 선택해 품질 요약과 권장 조치를 생성합니다.</p>
              </div>
            </div>
            <div className="grid two">
              <div className="field">
                <label>유형</label>
                <select className="select" value={form.reportType} onChange={(event) => setForm({ ...form, reportType: event.target.value as "daily" | "weekly" })}>
                  <option value="daily">일일</option>
                  <option value="weekly">주간</option>
                </select>
              </div>
              <div className="field">
                <label>시작일</label>
                <input className="input" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>종료일</label>
              <input className="input" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </div>
            <button className="button"><FilePlus size={16} /> 생성</button>
          </form>
          <div className="panel-header" style={{ marginTop: 20 }}>
            <div>
              <h2>리포트 목록</h2>
              <p className="panel-subtitle">생성된 리포트를 선택하거나 삭제합니다.</p>
            </div>
          </div>
          {reports.length === 0 ? <div className="empty">생성된 리포트가 없습니다.</div> : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td><button className="button secondary" onClick={() => setSelected(report)}>{report.title}</button></td>
                      <td>{report.createdAt.slice(0, 10)}</td>
                      <td>
                        <button
                          className="button danger"
                          disabled={deletingId === report.id}
                          onClick={() => deleteReport(report)}
                          title="리포트 삭제"
                          type="button"
                        >
                          <Trash2 size={16} /> {deletingId === report.id ? "삭제 중" : "삭제"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>리포트 보기</h2>
              <p className="panel-subtitle">핵심 지표와 개선 액션을 검토합니다.</p>
            </div>
          </div>
          {!selected ? (
            <div className="empty">리포트를 선택하세요.</div>
          ) : (
            <div className="grid">
              <h3>{selected.title}</h3>
              <p className="report-summary">{selected.summary}</p>
              <div className="grid two">
                <div className="card metric">검사<strong>{selected.metrics.summary.totalInspections}건</strong></div>
                <div className="card metric">불량률<strong>{selected.metrics.summary.defectRate}%</strong></div>
              </div>
              <h3>고위험 공정</h3>
              <p>{selected.riskProcesses.length ? selected.riskProcesses.join(", ") : "없음"}</p>
              <h3>권장 조치</h3>
              <ul className="checklist">
                {selected.recommendedActions.map((action, index) => <li key={`${action}-${index}`}><span>{action}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
