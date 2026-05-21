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
  ShieldCheck,
  TrendingUp,
  Wrench
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
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
  const topTrendPoint = useMemo(
    () => metrics?.trend.reduce((top, item) => item.defective > top.defective ? item : top, metrics.trend[0]) ?? null,
    [metrics]
  );
  const topRiskEquipment = useMemo(
    () => equipmentRows.filter((item) => item.riskLevel !== "low").slice(0, 3),
    [equipmentRows]
  );

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
          <section className={`dashboard-status-hero ${overallRisk(metrics)}`}>
            <div>
              <span><Gauge size={16} /> 현재 품질 상태</span>
              <h2>{qualityStatusLabel(overallRisk(metrics))}</h2>
              <p>
                불량률 {metrics.summary.defectRate}% · 조치 대기 {metrics.summary.actionRequiredCount ?? 0}건 ·
                고위험 설비 {metrics.summary.highRiskEquipmentCount}대 기준으로 산정했습니다.
              </p>
            </div>
            <div className="dashboard-status-metrics">
              <span><strong>{metrics.summary.defectRate}%</strong><small>기간 불량률</small></span>
              <span><strong>{metrics.summary.topDefectType ?? "-"}</strong><small>최다 불량 유형</small></span>
              <span><strong>{topTrendPoint ? topTrendPoint.date.slice(5) : "-"}</strong><small>피크 발생일</small></span>
            </div>
          </section>

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
                <span className={`dashboard-chip ${metrics.summary.defectRateDelta && metrics.summary.defectRateDelta > 0 ? "red" : "green"}`}>
                  {metrics.summary.defectRateDelta && metrics.summary.defectRateDelta > 0 ? "최근 불량률 상승" : "최근 불량률 안정"}
                </span>
              </div>
              <div className="dashboard-chart-stats">
                <span><TrendingUp size={14} /> 피크 {topTrendPoint?.defective ?? 0}건</span>
                <span>평균 {averageDefective(metrics.trend)}건</span>
              </div>
              <ResponsiveContainer width="100%" height={245}>
                <LineChart data={metrics.trend}>
                  <defs>
                    <linearGradient id="defectLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0d8b8f" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7edf2" />
                  <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} />
                  <YAxis />
                  <Tooltip content={<DashboardTooltip />} />
                  <ReferenceLine y={averageDefective(metrics.trend)} stroke="#f0ad29" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="defective" stroke="url(#defectLine)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 7 }} name="불량 수" />
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
                  <Tooltip content={<DashboardTooltip />} />
                  <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="5 5" />
                  <Bar dataKey="defectRate" radius={[6, 6, 0, 0]} name="불량률">
                    {processChart.map((entry) => (
                      <Cell key={entry.processId} fill={riskColor(entry.riskLevel)} />
                    ))}
                    <LabelList dataKey="defectRate" position="top" formatter={(value: number) => `${value}%`} />
                  </Bar>
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

          <section className="dashboard-priority-grid">
            <div className="dashboard-priority-head">
              <span><Wrench size={16} /> 우선 점검 대상</span>
              <strong>{topRiskEquipment.length ? `${topRiskEquipment.length}대 설비 확인 필요` : "즉시 점검 대상 없음"}</strong>
              <p>고위험/주의 설비를 먼저 확인한 뒤 전체 설비 위험도 표에서 상세 수치를 검토합니다.</p>
            </div>
            {(topRiskEquipment.length ? topRiskEquipment : equipmentRows.slice(0, 3)).map((item) => (
              <article className={`dashboard-priority-card ${item.riskLevel}`} key={item.equipmentId}>
                <span>{riskLabels[item.riskLevel]}</span>
                <strong>{item.equipmentName}</strong>
                <p>{item.processName} · 불량률 {item.defectRate}% · 불량 {item.defective}/{item.total}건</p>
                <em>{recommendedAction(item.riskLevel)}</em>
              </article>
            ))}
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

function DashboardTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string }>; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="dashboard-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.name}>{item.name}: {item.value}{item.name?.includes("불량률") ? "%" : ""}</span>
      ))}
    </div>
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

function overallRisk(metrics: DashboardMetricsResponse): RiskLevel {
  if (metrics.summary.highRiskEquipmentCount > 0 || metrics.summary.defectRate >= 15 || (metrics.summary.actionRequiredCount ?? 0) >= 5) {
    return "high";
  }
  if (metrics.summary.highRiskProcessCount > 0 || metrics.summary.defectRate >= 8 || (metrics.summary.actionRequiredCount ?? 0) > 0) {
    return "medium";
  }
  return "low";
}

function qualityStatusLabel(risk: RiskLevel) {
  if (risk === "high") {
    return "즉시 점검 필요";
  }
  if (risk === "medium") {
    return "주의 관찰";
  }
  return "안정";
}

function riskColor(risk: RiskLevel) {
  if (risk === "high") {
    return "#ef4444";
  }
  if (risk === "medium") {
    return "#f0ad29";
  }
  return "#0d8b8f";
}

function averageDefective(trend: DashboardMetricsResponse["trend"]) {
  if (trend.length === 0) {
    return 0;
  }
  return Math.round((trend.reduce((sum, item) => sum + item.defective, 0) / trend.length) * 10) / 10;
}

function formatUpdate(date?: string) {
  if (!date) {
    return "-";
  }
  return `${date} 19:30`;
}
