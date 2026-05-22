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
  Gauge,
  Home,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Wrench
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

const defectPalette = ["#ff5f4d", "#f0ad29", "#0d8b8f", "#7a8796", "#8c7fb8"];

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
  const trendChart = useMemo(
    () => metrics?.trend.map((item) => ({ ...item, label: item.date.slice(5), total: item.normal + item.defective })) ?? [],
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
      rank: index + 1,
      color: defectPalette[index % defectPalette.length]
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
            <div className="panel dashboard-chart-card dashboard-trend-card">
              <div className="dashboard-panel-head">
                <div>
                  <h2>일자별 불량 추이</h2>
                  <p>최근 7일 검사 흐름에서 정상/불량 변화를 함께 봅니다.</p>
                </div>
                <span className={`dashboard-chip ${metrics.summary.defectRateDelta && metrics.summary.defectRateDelta > 0 ? "red" : "green"}`}>
                  {metrics.summary.defectRateDelta && metrics.summary.defectRateDelta > 0 ? "최근 불량률 상승" : "최근 불량률 안정"}
                </span>
              </div>
              <div className="dashboard-chart-stats">
                <span><TrendingUp size={14} /> 불량 피크 {topTrendPoint?.defective ?? 0}건</span>
                <span>일평균 불량 {averageDefective(metrics.trend)}건</span>
                <span>누적 검사 {metrics.summary.totalInspections}건</span>
              </div>
              <ResponsiveContainer width="100%" height={286}>
                <AreaChart data={trendChart} margin={{ top: 16, right: 10, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="defectAreaStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0d8b8f" />
                      <stop offset="100%" stopColor="#b86a61" />
                    </linearGradient>
                    <linearGradient id="defectAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b86a61" stopOpacity={0.3} />
                      <stop offset="58%" stopColor="#b86a61" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="normalAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d8b8f" stopOpacity={0.18} />
                      <stop offset="58%" stopColor="#0d8b8f" stopOpacity={0.07} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 8" stroke="#e7edf2" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7a8796", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#7a8796", fontSize: 11 }} width={34} />
                  <Tooltip content={<DashboardTooltip />} />
                  <ReferenceLine y={averageDefective(metrics.trend)} stroke="#f0ad29" strokeDasharray="5 5" />
                  <Area
                    type="monotone"
                    dataKey="normal"
                    stroke="#0d8b8f"
                    fill="url(#normalAreaFill)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, fill: "#ffffff" }}
                    name="정상"
                  />
                  <Area
                    type="monotone"
                    dataKey="defective"
                    stroke="url(#defectAreaStroke)"
                    fill="url(#defectAreaFill)"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                    activeDot={{ r: 7, strokeWidth: 2, fill: "#ffffff" }}
                    name="불량"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="dashboard-chart-legend" aria-label="차트 범례">
                <span><i className="normal" /> 정상</span>
                <span><i className="defective" /> 불량</span>
                <span><i className="average" /> 불량 평균선</span>
              </div>
            </div>

            <div className="panel dashboard-chart-card">
              <div className="dashboard-panel-head">
                <div>
                  <h2>공정별 불량률</h2>
                  <p>위험 기준 15%를 넘는 공정을 우선순위로 정렬했습니다.</p>
                </div>
              </div>
              <div className="dashboard-rank-chart">
                <div className="dashboard-rank-threshold">
                  <span style={{ left: "15%" }} />
                  <em>위험 기준 15%</em>
                </div>
                {processChart.map((item, index) => (
                  <article className={`dashboard-rank-row ${item.riskLevel} rank-${index + 1}`} key={item.processId}>
                    <div className="dashboard-rank-row-head">
                      <span><b>{String(index + 1).padStart(2, "0")}</b>{item.processName}</span>
                      <strong>{item.defectRate}%</strong>
                    </div>
                    <div className="dashboard-rank-track">
                      <i style={{ width: `${Math.min(item.defectRate, 100)}%`, background: riskColor(item.riskLevel) }} />
                    </div>
                    <div className="dashboard-rank-row-foot">
                      <span>불량 {item.defective}/{item.total}건</span>
                      <em>{riskLabels[item.riskLevel]}</em>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel dashboard-defect-card">
              <h2>주요 불량 유형</h2>
              <p>전체 불량 대비 유형별 비율입니다.</p>
              {defectRows.length ? (
                <div className="dashboard-defect-visual">
                  <div className="dashboard-defect-lead" style={{ "--defect-color": defectRows[0]?.color } as React.CSSProperties}>
                    <span>최다 발생</span>
                    <strong>{metrics.summary.topDefectType ?? "-"}</strong>
                    <em>{defectRows[0]?.percent ?? 0}%</em>
                  </div>
                  <div>
                    <strong>{metrics.summary.defectiveCount}건</strong>
                    <span>전체 불량 중 최다 유형 비중을 기준으로 정렬했습니다.</span>
                  </div>
                </div>
              ) : null}
              <div className="dashboard-defect-list">
                {defectRows.length ? defectRows.map((item) => (
                  <div className="dashboard-defect-item" key={item.defectType}>
                    <span style={{ background: item.color, color: "#ffffff" }}>{item.rank}</span>
                    <strong>{item.label}</strong>
                    <div><i style={{ width: `${item.percent}%`, background: item.color }} /></div>
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
    return "주의 관찰 필요";
  }
  return "품질 상태 안정";
}

function riskColor(_risk: RiskLevel) {
  return "#d97870";
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
