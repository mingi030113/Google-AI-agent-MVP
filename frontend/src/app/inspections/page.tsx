"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ResultBadge, StatusBadge } from "@/components/ui/badges";
import { client, uploadBase } from "@/features/api/client";
import type { InspectionListResponse, MasterData } from "@/features/types/api";

type FilterState = {
  q: string;
  processId: string;
  equipmentId: string;
  result: string;
  status: string;
  startDate: string;
  endDate: string;
};

const initialFilters: FilterState = {
  q: "",
  processId: "",
  equipmentId: "",
  result: "",
  status: "",
  startDate: "",
  endDate: ""
};

const defectLabels: Record<string, string> = {
  scratch: "scratch",
  crack: "crack",
  dent: "dent",
  contamination: "contamination"
};

export default function InspectionsPage() {
  const [master, setMaster] = useState<MasterData | null>(null);
  const [data, setData] = useState<InspectionListResponse | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load({
    nextFilters = filters,
    nextPage = page,
    nextPageSize = pageSize
  }: {
    nextFilters?: FilterState;
    nextPage?: number;
    nextPageSize?: number;
  } = {}) {
    setLoading(true);
    setError("");
    const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
    client.inspections({ ...params, page: String(nextPage), pageSize: String(nextPageSize) })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    client.masterData().then(setMaster).catch((err) => setError(err.message));
    load();
  }, []);

  const summary = data?.summary ?? {
    total: 0,
    actionRequired: 0,
    pendingReview: 0,
    averageConfidence: 0
  };
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const pages = visiblePages(page, totalPages);

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "processId" ? { equipmentId: "" } : {})
    }));
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    load({ nextPage: 1 });
  }

  function reset() {
    setFilters(initialFilters);
    setPage(1);
    load({ nextFilters: initialFilters, nextPage: 1 });
  }

  function move(nextPage: number) {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safePage);
    load({ nextPage: safePage });
  }

  function changePageSize(value: string) {
    const nextPageSize = Number(value);
    setPageSize(nextPageSize);
    setPage(1);
    load({ nextPage: 1, nextPageSize });
  }

  return (
    <AppShell>
      <div className="history-titlebar">
        <div>
          <h1>검사 이력</h1>
          <p>검사 결과를 검색하고, 우선순위를 판단한 뒤 상세 결과와 후속 조치로 이동합니다.</p>
        </div>
        <Link className="button history-new-button" href="/inspections/new">
          <Plus size={16} /> 새 검사
        </Link>
      </div>

      <section className="history-kpis" aria-label="검사 이력 요약">
        <HistoryKpi icon={<FileText size={24} />} tone="blue" label="전체 이력" value={`${summary.total}건`} note="누적 검사 건수" />
        <HistoryKpi icon={<AlertTriangle size={24} />} tone="red" label="조치 필요" value={`${summary.actionRequired}건`} note="즉시 확인 대상" />
        <HistoryKpi icon={<RefreshCcw size={24} />} tone="amber" label="재검사 필요" value={`${summary.pendingReview}건`} note="확인 대기" />
        <HistoryKpi icon={<ShieldCheck size={24} />} tone="green" label="평균 신뢰도" value={`${summary.averageConfidence.toFixed(1)}%`} note="전체 평균" />
      </section>

      <form className="history-filter-card" onSubmit={search}>
        <label className="history-search">
          <Search size={17} />
          <input
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="LOT, 불량 유형, 설비명 검색"
          />
        </label>
        <div className="history-filter-grid">
          <HistoryField label="공정">
            <select value={filters.processId} onChange={(event) => updateFilter("processId", event.target.value)}>
              <option value="">전체</option>
              {master?.processes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </HistoryField>
          <HistoryField label="설비">
            <select value={filters.equipmentId} onChange={(event) => updateFilter("equipmentId", event.target.value)}>
              <option value="">전체</option>
              {master?.equipment
                .filter((item) => !filters.processId || item.processId === filters.processId)
                .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </HistoryField>
          <HistoryField label="판정">
            <select value={filters.result} onChange={(event) => updateFilter("result", event.target.value)}>
              <option value="">전체</option>
              <option value="normal">정상</option>
              <option value="suspicious">의심</option>
              <option value="defective">불량</option>
            </select>
          </HistoryField>
          <HistoryField label="상태">
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="">전체</option>
              <option value="pending">확인 대기</option>
              <option value="reviewed">확인 완료</option>
              <option value="action_required">조치 필요</option>
              <option value="closed">완료</option>
            </select>
          </HistoryField>
          <HistoryField label="기간" wide>
            <div className="history-date-range">
              <CalendarDays size={15} />
              <input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} />
              <span>-</span>
              <input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} />
            </div>
          </HistoryField>
          <div className="history-filter-actions">
            <button className="button secondary" type="button" onClick={reset}>
              <RotateCcw size={15} /> 초기화
            </button>
            <button className="button" type="submit">
              <Search size={15} /> 조회
            </button>
          </div>
        </div>
      </form>

      {error ? <div className="error">{error}</div> : null}
      <section className="history-table-card">
        {!data || loading ? (
          <div className="empty">검사 이력을 불러오는 중입니다.</div>
        ) : data.items.length === 0 ? (
          <div className="empty">조건에 맞는 검사 이력이 없습니다.</div>
        ) : (
          <>
            <div className="history-table-wrap">
              <table className="history-table">
              <thead>
                <tr>
                  <th>이미지</th>
                  <th>LOT</th>
                  <th>공정/설비</th>
                  <th>판정</th>
                  <th>불량 유형</th>
                  <th>신뢰도</th>
                  <th>위험도</th>
                  <th>상태</th>
                  <th>RAG 체크</th>
                  <th>일시</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td><img className="thumb" src={uploadBase(item.imageUrl)} alt="" /></td>
                    <td><Link href={`/inspections/${item.id}`}>{item.lotNo}</Link></td>
                    <td>{item.processName} / {item.equipmentName}</td>
                    <td><ResultBadge value={item.result} /></td>
                    <td>{item.defectType ? defectLabels[item.defectType] ?? item.defectType : "-"}</td>
                    <td>{Math.round(item.confidence * 100)}%</td>
                    <td><RiskPill value={riskFor(item.result, item.confidence)} /></td>
                    <td><StatusBadge value={item.status} /></td>
                    <td><ChecklistProgress progress={item.checklistProgress} /></td>
                    <td>{item.inspectedAt.slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <div className="history-actions">
                        <Link className="history-outline-button" href={`/inspections/${item.id}`}>상세 보기</Link>
                        {item.status === "action_required" ? (
                          <Link className="history-agent-button" href={`/agent?inspectionId=${item.id}`}>
                            <Bot size={13} /> 조치 Agent
                          </Link>
                        ) : (
                          <span className="history-no-action">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            <div className="history-pagination">
              <span>전체 {data.total}건</span>
              <select value={pageSize} onChange={(event) => changePageSize(event.target.value)} aria-label="페이지당 표시 건수">
                <option value="10">10개씩 보기</option>
                <option value="20">20개씩 보기</option>
                <option value="50">50개씩 보기</option>
              </select>
              <div className="history-page-controls">
                <button type="button" onClick={() => move(1)} disabled={page === 1} aria-label="첫 페이지"><ChevronsLeft size={16} /></button>
                <button type="button" onClick={() => move(page - 1)} disabled={page === 1} aria-label="이전 페이지"><ChevronLeft size={16} /></button>
                {pages.map((item) => item === "gap" ? (
                  <span className="history-page-gap" key={`${item}-${page}`}>...</span>
                ) : (
                  <button className={item === page ? "active" : ""} type="button" onClick={() => move(item)} key={item}>{item}</button>
                ))}
                <button type="button" onClick={() => move(page + 1)} disabled={page === totalPages} aria-label="다음 페이지"><ChevronRight size={16} /></button>
                <button type="button" onClick={() => move(totalPages)} disabled={page === totalPages} aria-label="마지막 페이지"><ChevronsRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function HistoryKpi({
  icon,
  tone,
  label,
  value,
  note
}: {
  icon: React.ReactNode;
  tone: "blue" | "red" | "amber" | "green";
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="history-kpi">
      <div className={`history-kpi-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function HistoryField({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "history-field wide" : "history-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function RiskPill({ value }: { value: "low" | "medium" | "high" }) {
  const label = value === "high" ? "High" : value === "medium" ? "Medium" : "Low";
  return <span className={`history-risk ${value}`}>{label}</span>;
}

function ChecklistProgress({ progress }: { progress?: { completed: number; total: number } }) {
  if (!progress?.total) {
    return <span className="history-checklist-progress empty">-</span>;
  }

  const percent = Math.round((progress.completed / progress.total) * 100);
  return (
    <span className={percent === 100 ? "history-checklist-progress complete" : "history-checklist-progress"}>
      <i><b style={{ width: `${percent}%` }} /></i>
      <em>{progress.completed}/{progress.total}</em>
    </span>
  );
}

function riskFor(result: string, confidence: number) {
  if (result === "normal") {
    return "low";
  }
  if (result === "suspicious") {
    return "medium";
  }
  return confidence >= 0.9 ? "high" : "medium";
}

function visiblePages(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([1, total, current - 1, current, current + 1]);
  return [...pages]
    .filter((item) => item >= 1 && item <= total)
    .sort((left, right) => left - right)
    .reduce<Array<number | "gap">>((items, item, index, sorted) => {
      if (index > 0 && item - sorted[index - 1] > 1) {
        items.push("gap");
      }
      items.push(item);
      return items;
    }, []);
}
