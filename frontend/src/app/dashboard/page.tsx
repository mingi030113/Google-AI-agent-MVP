"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckSquare,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  Gauge,
  Home,
  RefreshCcw,
  ShieldCheck
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { client } from "@/features/api/client";
import type { DashboardMetricsResponse, RiskLevel } from "@/features/types/api";

const defectLabels: Record<string, string> = {
  scratch: "scratch",
  contamination: "contamination",
  dent: "dent",
  crack: "crack"
};

const riskLabels: Record<RiskLevel, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음"
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.dashboard().then(setMetrics).catch((err) => setError(err.message));
  }, []);

  const processChart = useMemo(
    () => metrics?.processMetrics.filter((item) => item.total > 0).sort((left, right) => right.defectRate - left.defectRate).slice(0, 4) ?? [],
    [metrics]
  );
  const equipmentRows = useMemo(
    () => metrics?.equipmentMetrics.filter((item) => item.total > 0).sort((left, right) => right.defectRate - left.defectRate) ?? [],
    [metrics]
  );
  const defectRows = useMemo(() => {
    if (!metrics) {
      return [];
    }
    const total = metrics.summary.defectiveCount || 1;
    return metrics.defectTypeDistribution.map((item, index) => ({
      ...item,
      label: defectLabels[item.defectType] ?? item.defectType,
      percent: Math.round((item.count / total) * 1000) / 10,
      rank: index + 1
    }));
  }, [metrics]);

  return (
    <AppShell>
      <div className="dashboard-breadcrumb">
        <Home size={14} />
        <ChevronRight size={14} />
        <span>대시보드</span>
        <ChevronRight size={14} />
        <strong>품질 대시보드</strong>
        <span className="dashboard-updated"><RefreshCcw size={13} /> 마지막 업데이트 {formatUpdate(metrics?.summary.todayDate)}</span>
      </div>

      <header className="dashboard-title-row">
        <div>
          <h1>품질 대시보드</h1>
          <p>최근 검사 데이터를 기반으로 불량률과 고위험 설비를 확인합니다.</p>
        </div>
        <div className="dashboard-quick-nav">
          <Link href="/inspections/new"><Gauge size={21} /><span><strong>Vision 검사</strong><small>이미지 기반 검사 실행</small></span></Link>
          <Link href="/agent"><Bot size={21} /><span><strong>RAG Agent</strong><small>불량 유형 검색</small></span></Link>
          <Link href="/inspections"><ClipboardCheck size={21} /><span><strong>조치 이력</strong><small>작업 및 피드백 조회</small></span></Link>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {!metrics ? (
        <div className="empty">지표를 불러오는 중입니다.</div>
      ) : (
        <>
          <section className="dashboard-kpis">
            <KpiCard icon={CheckSquare} label="오늘 검사" value={`${metrics.summary.todayInspections ?? metrics.summary.totalInspections}건`} delta={metrics.summary.inspectionDelta ?? 0} help="오늘 누적 검사 수" tone="teal" />
            <KpiCard icon={AlertTriangle} label="불량 감지" value={`${metrics.summary.todayDefectiveCount ?? metrics.summary.defectiveCount}건`} delta={metrics.summary.defectiveDelta ?? 0} help="오늘 누적 불량 수" tone="red" />
            <KpiCard icon={BarChart3} label="불량률" value={`${metrics.summary.defectRate}%`} delta={metrics.summary.defectRateDelta ?? 0} help="이전 대비" tone="green" suffix="%p" />
            <KpiCard icon={AlertTriangle} label="조치 대기" value={`${metrics.summary.actionRequiredCount ?? 0}건`} help="즉시 조치 필요" tone="orange" />
            <KpiCard icon={ShieldCheck} label="고위험 설비" value={`${metrics.summary.highRiskEquipmentCount}대`} help="즉시 점검 대상" tone="blue" />
          </section>

          <section className="dashboard-main-grid">
            <div className="panel dashboard-chart-card">
              <div className="dashboard-panel-head">
                <div>
                  <h2>일자별 불량 추이</h2>
                  <p>최근 7일 불량 수 추이입니다.</p>
                </div>
                <span className="dashboard-chip red">최근 24시간 불량 증가</span>
              </div>
              <ResponsiveContainer width="100%" height={245}>
                <LineChart data={metrics.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                  <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="defective" stroke="#ef4444" strokeWidth={3} dot={{ r: 3 }} name="불량 수" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="panel dashboard-chart-card">
              <div className="dashboard-panel-head">
                <div>
                  <h2>공정별 불량률</h2>
                  <p>공정별 불량률 비교입니다.</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={245}>
                <BarChart data={processChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" vertical={false} />
                  <XAxis dataKey="processName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="defectRate" fill="#087d83" radius={[6, 6, 0, 0]} name="불량률" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel dashboard-defect-card">
              <h2>주요 불량 유형</h2>
              <p>전체 불량 대비 유형별 비율입니다.</p>
              <div className="dashboard-defect-list">
                {defectRows.length ? defectRows.map((item) => (
                  <div className="dashboard-defect-item" key={item.defectType}>
                    <span>{item.rank}</span>
                    <strong>{item.label}</strong>
                    <div><i style={{ width: `${item.percent}%` }} /></div>
                    <em>{item.percent}%</em>
                  </div>
                )) : <div className="empty">불량 유형 데이터가 없습니다.</div>}
              </div>
              <Link className="dashboard-more" href="/inspections">모든 불량 유형 보기 <ChevronRight size={15} /></Link>
            </div>
          </section>

          <section className="panel dashboard-risk-table-card">
            <div className="dashboard-panel-head">
              <div>
                <h2>설비 위험도</h2>
                <p>설비별 불량률과 위험도를 기준으로 우선 점검 대상을 확인하세요.</p>
              </div>
              <Link className="button secondary" href="/inspections">전체 설비 보기 <ChevronRight size={16} /></Link>
            </div>
            <div className="table-wrap">
              <table className="table dashboard-risk-table">
                <thead>
                  <tr>
                    <th>설비</th>
                    <th>공정</th>
                    <th>검사 수</th>
                    <th>불량 수</th>
                    <th>불량률</th>
                    <th>위험도</th>
                    <th>권장 조치</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentRows.map((item) => (
                    <tr key={item.equipmentId}>
                      <td><strong>{item.equipmentName}</strong></td>
                      <td>{item.processName}</td>
                      <td>{item.total}</td>
                      <td>{item.defective}</td>
                      <td>{item.defectRate}%</td>
                      <td><span className={`dashboard-risk ${item.riskLevel}`}>{riskLabels[item.riskLevel]}</span></td>
                      <td><span className={`dashboard-action ${item.riskLevel}`}>{recommendedAction(item.riskLevel)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  help,
  tone,
  suffix = ""
}: {
  icon: typeof CheckSquare;
  label: string;
  value: string;
  delta?: number;
  help: string;
  tone: "teal" | "red" | "green" | "orange" | "blue";
  suffix?: string;
}) {
  return (
    <div className={`dashboard-kpi ${tone}`}>
      <Icon size={27} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {delta !== undefined ? <em className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? "+" : ""}{delta}{suffix}</em> : null}
      </div>
      <small>{help}</small>
    </div>
  );
}

function recommendedAction(risk: RiskLevel) {
  if (risk === "high") {
    return "즉시 점검";
  }
  if (risk === "medium") {
    return "추이 관찰";
  }
  return "정상";
}

function formatUpdate(date?: string) {
  if (!date) {
    return "-";
  }
  return `${date} 19:30`;
}
