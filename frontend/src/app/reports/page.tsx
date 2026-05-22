"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FilePlus,
  FileText,
  Lightbulb,
  LoaderCircle,
  Printer,
  SearchCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Wrench
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { client } from "@/features/api/client";
import type { QualityReport } from "@/features/types/api";

export default function ReportsPage() {
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [selected, setSelected] = useState<QualityReport | null>(null);
  const [form, setForm] = useState({ reportType: "daily" as "daily" | "weekly", startDate: "2026-05-12", endDate: "2026-05-18" });
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
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
    setError("");
    setCreating(true);
    try {
      const result = await client.createReport(form);
      setReports((items) => [result.report, ...items]);
      setSelected(result.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "리포트 생성에 실패했습니다.");
    } finally {
      setCreating(false);
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

  function printReport() {
    if (!selected) {
      return;
    }

    const previousTitle = document.title;
    document.title = `${selected.title.replace(/[\\/:*?"<>|]/g, "_")}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 300);
  }

  const selectedDefectRate = selected?.metrics.summary.defectRate ?? 0;
  const selectedTotal = selected?.metrics.summary.totalInspections ?? 0;
  const selectedDefective = selected?.metrics.summary.defectiveCount ?? 0;
  const selectedHighRisk = selected?.riskProcesses.length ?? 0;
  const endDateLimit = form.reportType === "weekly" ? addDays(form.startDate, 6) : form.startDate;
  const dateRuleMessage = form.reportType === "daily"
    ? "일일 리포트는 하루 단위로만 생성됩니다."
    : "주간 리포트는 시작일 기준 최대 7일까지만 생성됩니다.";

  function updateReportType(reportType: "daily" | "weekly") {
    setForm((current) => ({
      ...current,
      reportType,
      endDate: reportType === "daily" ? current.startDate : clampEndDate(current.endDate, current.startDate, addDays(current.startDate, 6))
    }));
  }

  function updateStartDate(startDate: string) {
    setForm((current) => ({
      ...current,
      startDate,
      endDate: current.reportType === "daily" ? startDate : clampEndDate(current.endDate, startDate, addDays(startDate, 6))
    }));
  }

  function updateEndDate(endDate: string) {
    setForm((current) => ({
      ...current,
      endDate: current.reportType === "daily" ? current.startDate : clampEndDate(endDate, current.startDate, addDays(current.startDate, 6))
    }));
  }

  return (
    <AppShell>
      <PageHeader title="리포트" description="기간별 품질 리포트를 생성하고 권장 조치를 확인합니다." />
      {error ? <div className="error">{error}</div> : null}

      <div className="report-workspace">
        <section className="report-create-panel">
          <div className="report-create-copy">
            <span><Sparkles size={15} /> 품질 리포트 생성</span>
            <h2>기간 데이터를 요약하고 다음 조치까지 연결합니다.</h2>
            <p>검사 결과, 불량률, 위험 공정, 권장 조치를 하나의 검토 문서로 묶어 확인합니다.</p>
          </div>
          <form className="report-create-form" onSubmit={submit}>
            <div className="field">
              <label>유형</label>
              <select className="select" value={form.reportType} onChange={(event) => updateReportType(event.target.value as "daily" | "weekly")}>
                <option value="daily">일일</option>
                <option value="weekly">주간</option>
              </select>
            </div>
            <div className="field">
              <label>시작일</label>
              <input className="input" type="date" value={form.startDate} onChange={(event) => updateStartDate(event.target.value)} />
            </div>
            <div className="field">
              <label>종료일</label>
              <input
                className="input"
                disabled={form.reportType === "daily"}
                max={endDateLimit}
                min={form.startDate}
                type="date"
                value={form.endDate}
                onChange={(event) => updateEndDate(event.target.value)}
              />
            </div>
            <button className="button" disabled={creating} type="submit">
              {creating ? <LoaderCircle className="button-spinner" size={16} /> : <FilePlus size={16} />}
              {creating ? "생성 중" : "생성"}
            </button>
            <p className="report-date-rule">{dateRuleMessage}</p>
          </form>
          {creating ? (
            <div className="report-generation-status" role="status" aria-live="polite">
              <div className="report-generation-head">
                <span><LoaderCircle size={17} /> 리포트 생성 중</span>
                <strong>{form.reportType === "daily" ? "일일" : "주간"} 리포트 분석을 진행하고 있습니다.</strong>
              </div>
              <div className="report-generation-steps" aria-label="리포트 생성 단계">
                <span className="active"><i /> 검사 데이터 수집</span>
                <span className="active"><i /> 불량률 및 위험 공정 분석</span>
                <span><i /> 권장 조치 문서화</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="report-kpi-grid">
          <div className="report-kpi-card">
            <span><FileText size={17} /> 선택 리포트</span>
            <strong>{selected ? selected.reportType === "daily" ? "일일" : "주간" : "-"}</strong>
            <p>{selected ? `${formatDate(selected.startDate)} - ${formatDate(selected.endDate)}` : "리포트를 선택하세요"}</p>
          </div>
          <div className="report-kpi-card">
            <span><BarChart3 size={17} /> 검사 수</span>
            <strong>{selectedTotal.toLocaleString()}건</strong>
            <p>불량 {selectedDefective.toLocaleString()}건 포함</p>
          </div>
          <div className="report-kpi-card alert">
            <span><TrendingUp size={17} /> 불량률</span>
            <strong>{selectedDefectRate}%</strong>
            <p>{selectedDefectRate >= 10 ? "집중 관리 필요" : "관리 범위 내 추적"}</p>
          </div>
          <div className="report-kpi-card">
            <span><AlertTriangle size={17} /> 고위험 공정</span>
            <strong>{selectedHighRisk}개</strong>
            <p>{selectedHighRisk ? selected?.riskProcesses.slice(0, 2).join(", ") : "현재 없음"}</p>
          </div>
        </section>

        <div className="report-layout">
          <section className="report-list-panel">
            <div className="panel-header">
              <div>
                <h2>리포트 목록</h2>
                <p className="panel-subtitle">생성된 리포트를 선택해 상세 내용을 검토합니다.</p>
              </div>
            </div>
            {reports.length === 0 ? <div className="empty">생성된 리포트가 없습니다.</div> : (
              <div className="report-list">
                {reports.map((report) => {
                  const active = selected?.id === report.id;
                  return (
                    <article className={`report-list-item ${active ? "active" : ""}`} key={report.id}>
                      <button type="button" onClick={() => setSelected(report)}>
                        <span>{report.reportType === "daily" ? "일일 리포트" : "주간 리포트"}</span>
                        <strong>{report.title}</strong>
                        <em><CalendarDays size={14} /> {formatDate(report.startDate)} - {formatDate(report.endDate)}</em>
                      </button>
                      <div className="report-list-meta">
                        <span>불량률 {report.metrics.summary.defectRate}%</span>
                        <span>{report.recommendedActions.length}개 조치</span>
                        <button
                          disabled={deletingId === report.id}
                          onClick={() => deleteReport(report)}
                          title="리포트 삭제"
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="report-preview-panel">
            <div className="panel-header">
              <div>
                <h2>리포트 보기</h2>
                <p className="panel-subtitle">핵심 지표와 개선 액션을 검토합니다.</p>
              </div>
              {selected ? (
                <button className="button secondary report-print-button" type="button" onClick={printReport}>
                  <Printer size={16} /> PDF 저장
                </button>
              ) : null}
            </div>
            {!selected ? (
              <div className="empty">리포트를 선택하세요.</div>
            ) : (
              <article className="report-document">
                <header>
                  <span>{selected.reportType === "daily" ? "Daily Quality Report" : "Weekly Quality Report"}</span>
                  <h3>{selected.title}</h3>
                  <p>
                    {formatDate(selected.startDate)} - {formatDate(selected.endDate)} · 생성 {formatDate(selected.createdAt)}
                  </p>
                </header>

                <section className="report-section">
                  <h4><CheckCircle2 size={17} /> 요약 판단</h4>
                  <p className="report-summary">{selected.analysis?.executiveSummary ?? selected.summary}</p>
                </section>

                {selected.analysis?.keyFindings?.length ? (
                  <section className="report-section">
                    <h4><BarChart3 size={17} /> 핵심 발견 사항</h4>
                    <div className="report-finding-grid">
                      {selected.analysis.keyFindings.map((finding, index) => (
                        <div key={`${finding}-${index}`}>
                          <span>{index + 1}</span>
                          <p>{finding}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selected.analysis?.anomalySignals?.length ? (
                  <section className="report-section">
                    <h4><AlertTriangle size={17} /> 이상 징후</h4>
                    <div className="report-signal-list">
                      {selected.analysis.anomalySignals.map((signal) => (
                        <div className={`report-signal ${signal.severity}`} key={signal.title}>
                          <strong>{signal.title}</strong>
                          <p>{signal.evidence}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="report-section">
                  <h4><AlertTriangle size={17} /> 고위험 공정</h4>
                  <div className="report-risk-tags">
                    {selected.riskProcesses.length ? selected.riskProcesses.map((process) => <span key={process}>{process}</span>) : <span>고위험 공정 없음</span>}
                  </div>
                </section>

                {selected.analysis?.defectAnalysis?.length ? (
                  <section className="report-section">
                    <h4><SearchCheck size={17} /> 불량 유형 분석</h4>
                    <div className="report-analysis-table">
                      {selected.analysis.defectAnalysis.map((item) => (
                        <div key={item.defectType}>
                          <strong>{item.defectType}</strong>
                          <span>{item.count}건 · {item.rate}%</span>
                          <p>{item.interpretation}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selected.analysis?.rootCauseHypotheses?.length ? (
                  <section className="report-section">
                    <h4><Lightbulb size={17} /> 원인 추정</h4>
                    <div className="report-hypothesis-list">
                      {selected.analysis.rootCauseHypotheses.map((hypothesis, index) => (
                        <p key={`${hypothesis}-${index}`}>{hypothesis}</p>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="report-section">
                  <h4><Wrench size={17} /> 권장 조치</h4>
                  <div className="report-action-list">
                    {(selected.analysis?.recommendedActionItems ?? selected.recommendedActions.map((action) => ({ action, reason: "" }))).map((item, index) => (
                      <div key={`${item.action}-${index}`}>
                        <span>{index + 1}</span>
                        <p>
                          <strong>{item.action}</strong>
                          {item.reason ? <em>{item.reason}</em> : null}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {selected.analysis?.ragEvidence?.length || selected.analysis?.managerCommentary ? (
                  <section className="report-section">
                    <h4><ClipboardList size={17} /> 근거 및 보고 문구</h4>
                    {selected.analysis?.ragEvidence?.length ? (
                      <div className="report-evidence-list">
                        {selected.analysis.ragEvidence.map((source) => (
                          <div key={source.title}>
                            <strong>{source.title}</strong>
                            <p>{source.excerpt}</p>
                            <span>근거 점수 {source.score.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {selected.analysis?.managerCommentary ? <p className="report-manager-comment">{selected.analysis.managerCommentary}</p> : null}
                  </section>
                ) : null}
              </article>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampEndDate(value: string, min: string, max: string) {
  if (!value || value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
