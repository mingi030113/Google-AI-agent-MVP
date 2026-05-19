import { manuals } from "./domain.js";
import { embedText } from "./rag/embedding.js";

export async function answerAgentQuestion({ question, inspectionId, processId, equipmentId, defectType }, store) {
  const inspection = inspectionId ? await store.getInspection(inspectionId) : null;
  const inferredDefectType = defectType ?? inspection?.defectType;
  const loweredQuestion = question.toLowerCase();
  const ragMatches = store.searchManualChunks
    ? await store.searchManualChunks({
        embedding: embedText(`${question}\n${inferredDefectType ?? ""}\n${processId ?? ""}\n${equipmentId ?? ""}`),
        defectType: inferredDefectType,
        limit: 3
      })
    : [];

  if (ragMatches.length > 0) {
    const contextText = inspection
      ? `${inspection.processName} ${inspection.equipmentName} LOT ${inspection.lotNo}`
      : "선택한 조건";
    const sources = uniqueSources(ragMatches);
    const primary = sources[0] ?? ragMatches[0];
    const checklist = buildChecklistFromChunks(ragMatches);

    return {
      answer: `${contextText} 기준으로 업로드된 매뉴얼에서 "${primary.metadata?.title ?? "관련 기준서"}" 내용을 우선 확인했습니다. 핵심 근거는 "${compactExcerpt(primary.content)}"이며, 조치 결과와 재검사 결과를 검사 피드백에 남기세요.`,
      checklist,
      sources: sources.map((chunk) => ({
        id: sourceId(chunk),
        title: chunk.metadata?.title ?? chunk.manualId,
        excerpt: compactExcerpt(chunk.content),
        score: roundScore(chunk.score),
        manualId: chunk.manualId,
        chunkIndex: chunk.chunkIndex
      })),
      fallback: false
    };
  }

  const matchedManuals = manuals
    .map((manual) => ({
      manual,
      score: scoreManual(manual, { inferredDefectType, loweredQuestion, processId, equipmentId, inspection })
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);

  if (matchedManuals.length === 0) {
    return {
      answer:
        "관련 기준서를 특정하지 못했습니다. 최근 불량 유형, 설비 로그, 작업 조건을 함께 확인한 뒤 상세 조건으로 다시 질문해 주세요.",
      checklist: [
        { id: "fallback-1", label: "검사 상세에서 불량 유형 확인", priority: "medium" },
        { id: "fallback-2", label: "해당 설비의 최근 알람 로그 확인", priority: "medium" }
      ],
      sources: [],
      fallback: true
    };
  }

  const primary = matchedManuals[0].manual;
  const contextText = inspection
    ? `${inspection.processName} ${inspection.equipmentName} LOT ${inspection.lotNo}`
    : "선택한 조건";

  return {
    answer: `${contextText} 기준으로는 ${primary.title}를 우선 적용하는 것이 좋습니다. 원인 후보를 설비 상태, 이송/취급 조건, 작업대 오염 순서로 좁히고 조치 결과를 검사 피드백에 남기세요.`,
    checklist: primary.checklist,
    sources: matchedManuals.map(({ manual, score }) => ({
      id: manual.id,
      title: manual.title,
      excerpt: manual.excerpt,
      score
    })),
    fallback: false
  };
}

function uniqueSources(chunks) {
  const seen = new Set();
  const sources = [];

  for (const chunk of chunks) {
    const key = chunk.metadata?.title ?? chunk.manualId ?? chunk.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sources.push(chunk);
  }

  return sources;
}

function sourceId(chunk) {
  return `${chunk.manualId ?? "manual"}-${chunk.chunkIndex ?? chunk.id ?? "source"}`;
}

function buildChecklistFromChunks(chunks) {
  const rawLines = chunks
    .flatMap((chunk) => chunk.content.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
  const listLines = rawLines
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map(cleanChecklistLine)
    .filter(isActionLine)
    .filter((line, index, list) => list.indexOf(line) === index)
    .slice(0, 3);
  const lines = listLines.length > 0 ? listLines : rawLines
    .map(cleanChecklistLine)
    .filter(isActionLine)
    .filter((line, index, list) => list.indexOf(line) === index)
    .slice(0, 3);

  if (lines.length === 0) {
    return [
      { id: "rag-1", label: "매뉴얼 근거 확인 및 원인 후보 기록", priority: "high" },
      { id: "rag-2", label: "조치 후 동일 LOT 재검사", priority: "medium" }
    ];
  }

  return lines.map((label, index) => ({
    id: `rag-${index + 1}`,
    label: label.slice(0, 80),
    priority: index === 0 ? "high" : "medium"
  }));
}

function cleanChecklistLine(line) {
  return line.replace(/^[-*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
}

function isActionLine(line) {
  return (
    line.length >= 6 &&
    !line.startsWith("#") &&
    /확인|점검|제거|청소|교체|격리|보고|재검사|기록|수행|중지/.test(line)
  );
}

function compactExcerpt(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function roundScore(score) {
  return Math.max(0, Math.min(Math.round(Number(score ?? 0) * 100) / 100, 0.99));
}

function scoreManual(manual, { inferredDefectType, loweredQuestion, inspection }) {
  let score = 0;

  if (manual.defectType === inferredDefectType) {
    score += 0.72;
  }

  if (loweredQuestion.includes(manual.defectType)) {
    score += 0.18;
  }

  if (loweredQuestion.includes(manual.title.toLowerCase().slice(0, 4))) {
    score += 0.12;
  }

  if (inspection?.agentGuidance?.sources?.some((source) => source.title === manual.title)) {
    score += 0.08;
  }

  return Math.min(Math.round(score * 100) / 100, 0.98);
}
