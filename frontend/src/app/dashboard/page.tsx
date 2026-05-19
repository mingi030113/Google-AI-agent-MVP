"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RiskBadge } from "@/components/ui/badges";
import { client } from "@/features/api/client";
import type { DashboardMetricsResponse } from "@/features/types/api";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.dashboard().then(setMetrics).catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell>
      <PageHeader title="대시보드" description="최근 검사 데이터 기준으로 공정과 설비 위험도를 확인합니다." />
      {error ? <div className="error">{error}</div> : null}
      {!metrics ? (
        <div className="empty">지표를 불러오는 중입니다.</div>
      ) : (
        <>
          <div className="grid four">
            <Metric title="전체 검사" value={`${metrics.summary.totalInspections}건`} />
            <Metric title="불량률" value={`${metrics.summary.defectRate}%`} />
            <Metric title="주요 불량" value={metrics.summary.topDefectType ?? "-"} />
            <Metric title="고위험 설비" value={`${metrics.summary.highRiskEquipmentCount}대`} />
          </div>
          <div className="grid two">
            <div className="panel">
              <h2>일자별 불량 추이</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="defectRate" stroke="#c2413a" strokeWidth={2} name="불량률" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="panel">
              <h2>공정별 불량률</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.processMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="processName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="defectRate" fill="#176b87" name="불량률" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel">
            <h2>설비 위험도</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>설비</th>
                  <th>공정</th>
                  <th>검사</th>
                  <th>불량</th>
                  <th>불량률</th>
                  <th>위험도</th>
                </tr>
              </thead>
              <tbody>
                {metrics.equipmentMetrics.map((item) => (
                  <tr key={item.equipmentId}>
                    <td>{item.equipmentName}</td>
                    <td>{item.processName}</td>
                    <td>{item.total}</td>
                    <td>{item.defective}</td>
                    <td>{item.defectRate}%</td>
                    <td><RiskBadge value={item.riskLevel} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="card metric">
      {title}
      <strong>{value}</strong>
    </div>
  );
}
