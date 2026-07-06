import { manuals } from "./domain.js";
import { GeminiAgentAnswerClient } from "./agent/gemini-answer-client.js";
import { embedText } from "./rag/embedding.js";

export async function answerAgentQuestion({ question, inspectionId, processId, equipmentId, defectType }, store, { env = process.env } = {}) {
  const inspection = inspectionId ? await store.getInspection(inspectionId) : null;
  const inferredDefectType = defectType ?? inspection?.defectType;
  const inferredProcessId = processId ?? inspection?.processId;
  const inferredEquipmentId = equipmentId ?? inspection?.equipmentId;
  const intent = classifyQuestionIntent(question);
  const loweredQuestion = question.toLowerCase();
  const similarCases = await searchSimilarCases(store, {
    currentInspection: inspection,
    defectType: inferredDefectType,
    processId: inferredProcessId,
    equipmentId: inferredEquipmentId,
    lotNo: inspection?.lotNo
  });
  const ragMatches = store.searchManualChunks
    ? await store.searchManualChunks({
        embedding: embedText(buildRetrievalQuery({
          question,
          intent,
          inferredDefectType,
          processId: inferredProcessId,
          equipmentId: inferredEquipmentId,
          inspection,
          similarCases
        })),
        defectType: inferredDefectType,
        limit: 5
      })
    : [];

  if (ragMatches.length > 0) {
    const contextText = buildContextText(inspection);
    const sources = uniqueSources(ragMatches);
    const checklist = buildChecklistForIntent({ intent, chunks: ragMatches, inspection, defectType: inferredDefectType });
    const fallbackAnswer = buildRagAnswer({ intent, contextText, chunks: ragMatches, sources, checklist, inspection, defectType: inferredDefectType });
    const sourcePayload = sources.map((chunk) => ({
      id: sourceId(chunk),
      title: chunk.metadata?.title ?? chunk.manualId,
      excerpt: compactExcerpt(chunk.content),
      score: roundScore(chunk.score),
      manualId: chunk.manualId,
      chunkIndex: chunk.chunkIndex
    }));
    const generated = await generateFinalAnswer({
      env,
      question,
      intent,
      inspection,
      defectType: inferredDefectType,
      sources: sourcePayload,
      similarCases,
      checklist,
      fallbackAnswer
    });

    return {
      answer: generated.answer,
      checklist: generated.checklist,
      sources: sourcePayload,
      similarCases,
      answerDriver: generated.raw?.driver ?? generated.answerDriver ?? "local",
      answerModel: generated.raw?.model ?? generated.answerModel,
      answerFallbackReason: generated.fallbackReason,
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
      answer: buildNoSourceAnswer({ intent, inspection, defectType: inferredDefectType }),
      checklist: buildNoSourceChecklist(intent),
      sources: [],
      similarCases,
      answerDriver: "local",
      fallback: true
    };
  }

  const primary = matchedManuals[0].manual;
  const contextText = buildContextText(inspection);
  const checklist = buildManualChecklistForIntent({ intent, manual: primary, inspection, defectType: inferredDefectType });
  const fallbackAnswer = buildManualAnswer({ intent, contextText, manual: primary, checklist, inspection, defectType: inferredDefectType });
  const sourcePayload = matchedManuals.map(({ manual, score }) => ({
    id: manual.id,
    title: manual.title,
    excerpt: manual.excerpt,
    score
  }));
  const generated = await generateFinalAnswer({
    env,
    question,
    intent,
    inspection,
    defectType: inferredDefectType,
    sources: sourcePayload,
    similarCases,
    checklist,
    fallbackAnswer
  });

  return {
    answer: generated.answer,
    checklist: generated.checklist,
    sources: sourcePayload,
    similarCases,
    answerDriver: generated.raw?.driver ?? generated.answerDriver ?? "local",
    answerModel: generated.raw?.model ?? generated.answerModel,
    answerFallbackReason: generated.fallbackReason,
    fallback: false
  };
}

async function searchSimilarCases(store, criteria) {
  if (store.searchInspectionHistory) {
    return store.searchInspectionHistory({ ...criteria, limit: 3, lookbackDays: 30 });
  }

  if (store.listInspections) {
    const { findSimilarInspectionCases } = await import("./similar-case-service.js");
    return findSimilarInspectionCases(await store.listInspections(), { ...criteria, limit: 3, lookbackDays: 30 });
  }

  return [];
}

async function generateFinalAnswer({ env, question, intent, inspection, defectType, sources, similarCases, checklist, fallbackAnswer }) {
  const driver = resolveAgentAnswerDriver(env);
  if (driver !== "gemini") {
    return { answer: fallbackAnswer, checklist, answerDriver: "local" };
  }

  const model = env.GEMINI_AGENT_MODEL ?? "gemini-3-flash-preview";
  try {
    const client = new GeminiAgentAnswerClient({
      apiKey: env.GEMINI_API_KEY,
      model
    });
    return await client.generate({
      question,
      intent,
      context: buildGeminiContext({ inspection, defectType }),
      sources,
      similarCases,
      checklist,
      fallbackAnswer
    });
  } catch (error) {
    console.warn("Gemini Agent answer generation failed; falling back to local RAG:", error);
    return {
      answer: fallbackAnswer,
      checklist,
      answerDriver: "gemini-fallback",
      answerModel: model,
      fallbackReason: error instanceof Error ? error.message : "Gemini Agent answer generation failed."
    };
  }
}

function resolveAgentAnswerDriver(env) {
  const configured = String(env.AGENT_ANSWER_DRIVER ?? "").trim().toLowerCase();
  const hasApiKey = Boolean(env.GEMINI_API_KEY?.trim());

  if (configured === "local-only" || env.AGENT_ANSWER_FORCE_LOCAL === "true") {
    return "local";
  }

  if (hasApiKey) {
    return "gemini";
  }

  return configured === "gemini" ? "gemini" : "local";
}

function buildGeminiContext({ inspection, defectType }) {
  if (!inspection) {
    return {
      defectType,
      hasInspectionContext: false
    };
  }

  return {
    hasInspectionContext: true,
    inspectionId: inspection.id,
    lotNo: inspection.lotNo,
    processName: inspection.processName,
    equipmentName: inspection.equipmentName,
    result: inspection.result,
    defectType,
    confidence: inspection.confidence,
    status: inspection.status,
    memo: inspection.memo,
    latestFeedback: inspection.feedback
  };
}

function classifyQuestionIntent(question) {
  const text = String(question ?? "").toLowerCase();
  if (/재검사|re-?inspect|재확인|합격|불합격|승인|판정 기준|검사 기준/.test(text)) {
    return "reinspection";
  }
  if (/작업자|현장|전달|안내|공지|문구|메시지|말해/.test(text)) {
    return "worker_message";
  }
  if (/리포트|보고서|요약|정리|작성|상신|회의/.test(text)) {
    return "report_summary";
  }
  if (/유사|사례|과거|이력|전에|반복|재발/.test(text)) {
    return "similar_cases";
  }
  if (/원인|왜|어디|무엇|뭐|점검|확인|봐야|발생|의심/.test(text)) {
    return "cause_analysis";
  }
  if (/조치|대응|처리|수리|청소|교체|격리|중지|해야/.test(text)) {
    return "action_plan";
  }
  return "general";
}

function buildRetrievalQuery({ question, intent, inferredDefectType, processId, equipmentId, inspection, similarCases = [] }) {
  const intentTerms = {
    action_plan: "조치 순서 대응 처리 격리 청소 교체 재검사",
    reinspection: "재검사 기준 합격 불합격 승인 기록 동일 LOT",
    cause_analysis: "원인 후보 설비 점검 오염 마모 이송 조건",
    worker_message: "작업자 전달 안내 현장 조치 문구",
    report_summary: "리포트 요약 보고 원인 조치 재발 방지",
    similar_cases: "유사 사례 반복 불량 재발 이력",
    general: "품질 기준서 조치 원인 재검사"
  }[intent];

  return [
    question,
    intentTerms,
    inferredDefectType,
    processId,
    equipmentId,
    inspection?.processName,
    inspection?.equipmentName,
    inspection?.lotNo,
    inspection?.memo,
    ...similarCases.flatMap((item) => [item.defectType, item.actionTaken, item.reinspectionResult])
  ].filter(Boolean).join("\n");
}

function buildRagAnswer({ intent, contextText, chunks, sources, checklist, inspection, defectType }) {
  const primary = sources[0] ?? chunks[0];
  const title = primary.metadata?.title ?? "관련 기준서";
  const evidence = summarizeEvidence(chunks);
  const target = defectType ? `${defectType} 불량` : "해당 검사 건";

  if (intent === "cause_analysis") {
    return `${contextText}의 ${target}은 "${title}" 기준상 ${evidence} 항목을 먼저 의심하는 것이 맞습니다. 원인 확인은 1) 설비 접촉/마모, 2) 이송 또는 세척 조건, 3) 작업대/보관 구역 오염 순서로 좁히고, 확인되지 않은 항목은 추정 원인으로 확정하지 마세요.`;
  }
  if (intent === "reinspection") {
    return `${contextText}는 조치 후 동일 LOT 또는 동일 조건 샘플을 재검사해야 합니다. "${title}"에서 확인한 기준은 ${evidence}이며, 재검사 결과가 정상일 때만 상태를 종료하고 불량이 반복되면 설비 조건을 다시 고정한 뒤 추가 조치로 넘기세요.`;
  }
  if (intent === "worker_message") {
    return `작업자 전달 문구: ${contextText}에서 ${target}이 확인되었습니다. ${checklist[0]?.label ?? "기준서의 1차 조치"}를 먼저 수행하고, 완료 후 재검사 결과와 특이사항을 검사 피드백에 기록해 주세요. 기준 근거는 "${title}"입니다.`;
  }
  if (intent === "report_summary") {
    return `리포트 반영 문구: ${contextText}에서 ${target}이 발생했으며, RAG 기준서 "${title}"는 ${evidence}를 핵심 점검 항목으로 제시합니다. 권장 조치는 ${checklist.map((item) => item.label).slice(0, 2).join(", ")}이며, 재발 여부는 동일 LOT 재검사 결과로 확인합니다.`;
  }
  if (intent === "similar_cases") {
    return `${contextText}와 유사한 기준서 근거는 "${title}"입니다. 현재 MVP는 과거 조치 이력 전문 검색보다 매뉴얼 chunk 검색을 우선하므로, 유사 사례 판단은 ${evidence} 조건이 같은지 비교하는 방식으로 보세요. 같은 설비나 LOT에서 반복되면 재발 불량으로 분류해 리포트에 남기는 것이 좋습니다.`;
  }
  if (intent === "action_plan") {
    return `${contextText} 기준으로 "${title}"의 조치 절차를 우선 적용하세요. 핵심 근거는 ${evidence}이며, 1차 조치 후 동일 LOT 재검사와 피드백 기록까지 완료해야 조치가 닫힙니다.`;
  }
  if (inspection?.result === "normal") {
    return `${contextText}는 현재 정상 판정이지만, 질문한 조건과 가까운 기준서 "${title}"를 확인했습니다. 불필요한 조치보다 ${evidence} 항목을 예방 점검으로 확인하고, 이상이 없으면 정상 판정 근거만 기록하세요.`;
  }
  return `${contextText} 기준으로 업로드된 매뉴얼 "${title}"를 우선 확인했습니다. 핵심 근거는 ${evidence}이며, 질문 목적에 맞춰 조치, 재검사, 기록 순서로 처리하세요.`;
}

function buildManualAnswer({ intent, contextText, manual, checklist, inspection, defectType }) {
  const target = defectType ? `${defectType} 불량` : "해당 검사 건";
  const firstActions = checklist.map((item) => item.label).slice(0, 2).join(", ");

  if (intent === "cause_analysis") {
    return `${contextText}의 ${target} 원인은 ${manual.title} 기준상 "${manual.excerpt}" 흐름으로 좁히는 것이 좋습니다. 먼저 ${firstActions} 항목을 확인하고, 설비 로그와 작업 조건이 맞지 않으면 원인 후보를 보류하세요.`;
  }
  if (intent === "reinspection") {
    return `${contextText}는 ${manual.title}에 따른 조치 후 재검사가 필요합니다. ${firstActions} 완료 뒤 동일 LOT를 다시 확인하고, 정상 전환 여부와 조치 내용을 검사 피드백에 기록하세요.`;
  }
  if (intent === "worker_message") {
    return `작업자 전달 문구: ${contextText}에서 ${target} 관련 확인이 필요합니다. ${checklist[0]?.label ?? manual.excerpt}를 우선 수행하고 완료 시 재검사 결과를 피드백에 남겨 주세요.`;
  }
  if (intent === "report_summary") {
    return `리포트 반영 문구: ${contextText}에서 ${target}이 확인되어 ${manual.title}를 적용했습니다. 주요 조치는 ${firstActions}이며, 재발 방지를 위해 동일 설비 조건과 재검사 결과를 추적합니다.`;
  }
  if (intent === "similar_cases") {
    return `${contextText}와 유사한 케이스는 ${manual.title}의 원인 조건과 비교하면 됩니다. 특히 "${manual.excerpt}"에 해당하는 설비/작업 조건이 반복되는지 검사 이력에서 확인하세요.`;
  }
  if (intent === "action_plan") {
    return `${contextText} 기준으로는 ${manual.title}를 우선 적용하세요. ${firstActions} 순서로 처리한 뒤 조치 결과와 재검사 결과를 검사 피드백에 남기면 됩니다.`;
  }
  if (inspection?.result === "normal") {
    return `${contextText}는 정상 판정입니다. 다만 예방 점검 관점에서 ${manual.title}의 "${manual.excerpt}" 항목만 확인하고, 이상이 없으면 추가 조치 없이 정상 근거를 기록하세요.`;
  }
  return `${contextText} 기준으로는 ${manual.title}를 우선 적용하는 것이 좋습니다. ${manual.excerpt} 조치 결과를 검사 피드백에 남기세요.`;
}

function buildNoSourceAnswer({ intent, inspection, defectType }) {
  const contextText = buildContextText(inspection);
  const target = defectType ? `${defectType} 불량` : "해당 검사 건";
  if (intent === "cause_analysis") {
    return `${contextText}의 ${target} 원인을 특정할 기준서를 찾지 못했습니다. 설비 로그, 최근 조건 변경, 작업대 오염 여부를 확인한 뒤 불량 유형이나 설비명을 포함해 다시 질문해 주세요.`;
  }
  if (intent === "reinspection") {
    return `${contextText}에 적용할 재검사 기준서를 찾지 못했습니다. 임시로는 조치 전후 이미지를 비교하고 동일 LOT 재검사 결과를 기록하되, 품질관리자가 기준서를 먼저 등록하는 것이 필요합니다.`;
  }
  if (intent === "worker_message") {
    return `작업자 전달 문구를 만들 기준서가 부족합니다. ${contextText}의 검사 결과, 불량 유형, 필요한 조치를 확인한 뒤 기준서 업로드 후 다시 생성하세요.`;
  }
  if (intent === "report_summary") {
    return `${contextText}의 리포트 문구를 만들 기준서 근거가 부족합니다. 이번 건은 기준서 미매칭으로 표시하고, 원인/조치/재검사 결과를 수동으로 보완하세요.`;
  }
  return "관련 기준서를 특정하지 못했습니다. 최근 불량 유형, 설비 로그, 작업 조건을 함께 확인한 뒤 상세 조건으로 다시 질문해 주세요.";
}

function buildNoSourceChecklist(intent) {
  const common = [
    { id: "fallback-1", label: "검사 상세에서 불량 유형과 설비 조건 확인", priority: "medium" },
    { id: "fallback-2", label: "해당 설비의 최근 알람 로그와 작업 조건 확인", priority: "medium" }
  ];
  if (intent === "reinspection") {
    return [
      { id: "fallback-recheck-1", label: "동일 LOT 재검사 기준을 품질관리자에게 확인", priority: "high" },
      { id: "fallback-recheck-2", label: "조치 전후 이미지와 판정 결과 기록", priority: "medium" }
    ];
  }
  if (intent === "worker_message") {
    return [
      { id: "fallback-worker-1", label: "현장 전달 전 불량 유형과 금지 조치 확인", priority: "high" },
      { id: "fallback-worker-2", label: "작업자에게 조치 완료와 재검사 기록 요청", priority: "medium" }
    ];
  }
  return common;
}

function buildContextText(inspection) {
  return inspection
    ? `${inspection.processName} ${inspection.equipmentName} LOT ${inspection.lotNo}`
    : "선택한 조건";
}

function buildChecklistForIntent({ intent, chunks, inspection, defectType }) {
  const extracted = buildChecklistFromChunks(chunks);
  const contextLabel = inspection ? `${inspection.lotNo} 재검사` : "동일 LOT 재검사";
  const typeLabel = defectType ? `${defectType} 불량` : "불량";

  const byIntent = {
    cause_analysis: [
      { id: "cause-1", label: `${typeLabel} 원인 후보를 설비/이송/작업환경으로 분리해 확인`, priority: "high" },
      { id: "cause-2", label: "상위 RAG 근거와 실제 설비 로그가 일치하는지 확인", priority: "high" },
      { id: "cause-3", label: "확정 원인과 보류 원인을 검사 피드백에 구분 기록", priority: "medium" }
    ],
    reinspection: [
      { id: "recheck-1", label: "조치 완료 후 동일 LOT 또는 동일 조건 샘플 재검사", priority: "high" },
      { id: "recheck-2", label: "재검사 이미지와 AI 판정 결과를 기존 검사 건에 기록", priority: "medium" },
      { id: "recheck-3", label: "불량 반복 시 상태를 조치 필요로 유지하고 설비 조건 재점검", priority: "high" }
    ],
    worker_message: [
      { id: "worker-1", label: "작업자에게 1차 조치 항목과 금지 조건 전달", priority: "high" },
      { id: "worker-2", label: "조치 완료 시각과 재검사 결과를 피드백에 남기도록 요청", priority: "medium" },
      { id: "worker-3", label: "반복 발생 시 품질관리자 호출 기준 안내", priority: "medium" }
    ],
    report_summary: [
      { id: "report-1", label: "발생 LOT, 공정, 설비, 불량 유형을 리포트 요약에 반영", priority: "medium" },
      { id: "report-2", label: "RAG 근거와 수행 조치를 원인/대응/재발방지로 분리 기록", priority: "medium" },
      { id: "report-3", label: `${contextLabel} 결과를 리포트 결론에 반영`, priority: "high" }
    ],
    similar_cases: [
      { id: "similar-1", label: "같은 설비, 같은 불량 유형의 최근 검사 이력 확인", priority: "high" },
      { id: "similar-2", label: "RAG 근거의 원인 조건과 현재 작업 조건 비교", priority: "medium" },
      { id: "similar-3", label: "반복 발생이면 재발 불량으로 리포트에 표시", priority: "medium" }
    ]
  }[intent];

  if (byIntent) {
    return mergeChecklist(byIntent, extracted).slice(0, 4);
  }

  return extracted;
}

function buildManualChecklistForIntent({ intent, manual, inspection, defectType }) {
  const base = manual.checklist?.length ? manual.checklist : [
    { id: `${manual.id}-fallback`, label: manual.excerpt, priority: "medium" }
  ];
  return buildChecklistForIntent({
    intent,
    chunks: [{
      id: manual.id,
      manualId: manual.id,
      chunkIndex: 0,
      content: [
        manual.excerpt,
        ...base.map((item) => `- ${item.label}`)
      ].join("\n"),
      metadata: {
        title: manual.title,
        defectType: manual.defectType
      },
      score: 0.8
    }],
    inspection,
    defectType
  });
}

function mergeChecklist(primary, secondary) {
  const seen = new Set();
  return [...primary, ...secondary]
    .filter((item) => {
      const key = item.label.trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((item, index) => ({
      ...item,
      id: item.id || `agent-step-${index + 1}`
    }));
}

function summarizeEvidence(chunks) {
  const candidates = chunks
    .flatMap((chunk) => chunk.content.split(/\r?\n/))
    .map(cleanChecklistLine)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter((line) => line.length >= 8)
    .filter((line) => !/^기준서|^목적|^범위/.test(line))
    .slice(0, 3);

  if (candidates.length === 0) {
    return `"${compactExcerpt(chunks[0]?.content ?? "기준서 근거")}"`;
  }

  return candidates.map((line) => `"${line.slice(0, 90)}"`).join(", ");
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
