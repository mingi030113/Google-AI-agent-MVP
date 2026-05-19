"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResultBadge, StatusBadge } from "@/components/ui/badges";
import { client, uploadBase } from "@/features/api/client";
import type { InspectionListResponse, MasterData } from "@/features/types/api";

export default function InspectionsPage() {
  const [master, setMaster] = useState<MasterData | null>(null);
  const [data, setData] = useState<InspectionListResponse | null>(null);
  const [filters, setFilters] = useState({ processId: "", equipmentId: "", result: "", status: "" });
  const [error, setError] = useState("");

  function load(next = filters) {
    const params = Object.fromEntries(Object.entries(next).filter(([, value]) => value));
    client.inspections(params).then(setData).catch((err) => setError(err.message));
  }

  useEffect(() => {
    client.masterData().then(setMaster).catch((err) => setError(err.message));
    load();
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="검사 이력"
        description="검사 결과를 필터링하고 상세 조치 내역으로 이동합니다."
        actions={<Link className="button" href="/inspections/new">새 검사</Link>}
      />
      <div className="panel toolbar">
        <div className="field">
          <label>공정</label>
          <select className="select" value={filters.processId} onChange={(event) => setFilters({ ...filters, processId: event.target.value, equipmentId: "" })}>
            <option value="">전체</option>
            {master?.processes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>설비</label>
          <select className="select" value={filters.equipmentId} onChange={(event) => setFilters({ ...filters, equipmentId: event.target.value })}>
            <option value="">전체</option>
            {master?.equipment
              .filter((item) => !filters.processId || item.processId === filters.processId)
              .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>판정</label>
          <select className="select" value={filters.result} onChange={(event) => setFilters({ ...filters, result: event.target.value })}>
            <option value="">전체</option>
            <option value="normal">정상</option>
            <option value="defective">불량</option>
          </select>
        </div>
        <div className="field">
          <label>상태</label>
          <select className="select" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">전체</option>
            <option value="pending">대기</option>
            <option value="reviewed">검토</option>
            <option value="action_required">조치 필요</option>
            <option value="closed">종결</option>
          </select>
        </div>
        <button className="button" onClick={() => load()}>조회</button>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="panel">
        {!data ? (
          <div className="empty">검사 이력을 불러오는 중입니다.</div>
        ) : data.items.length === 0 ? (
          <div className="empty">조건에 맞는 검사 이력이 없습니다.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>이미지</th>
                <th>LOT</th>
                <th>공정/설비</th>
                <th>판정</th>
                <th>불량 유형</th>
                <th>신뢰도</th>
                <th>상태</th>
                <th>일시</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td><img src={uploadBase(item.imageUrl)} alt="" width={42} height={42} style={{ objectFit: "contain" }} /></td>
                  <td><Link href={`/inspections/${item.id}`}>{item.lotNo}</Link></td>
                  <td>{item.processName} / {item.equipmentName}</td>
                  <td><ResultBadge value={item.result} /></td>
                  <td>{item.defectType ?? "-"}</td>
                  <td>{Math.round(item.confidence * 100)}%</td>
                  <td><StatusBadge value={item.status} /></td>
                  <td>{item.inspectedAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
