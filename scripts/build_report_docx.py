from __future__ import annotations

import html
import os
import zipfile
from pathlib import Path

OUT = Path("reports/품질관리_Agent_구현현황_보고서.docx")

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def run(text: str, bold: bool = False, color: str | None = None) -> str:
    props = []
    if bold:
        props.append("<w:b/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f"<w:r>{rpr}<w:t xml:space=\"preserve\">{esc(text)}</w:t></w:r>"


def paragraph(text: str = "", style: str | None = None, bullet: bool = False, number: bool = False) -> str:
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if bullet:
        ppr.append('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')
    if number:
        ppr.append('<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>')
    ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr_xml}{run(text)}</w:p>"


def heading(text: str, level: int = 1) -> str:
    return paragraph(text, f"Heading{level}")


def table(rows: list[list[str]], widths: list[int]) -> str:
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for width in widths)
    rows_xml = []
    for i, row in enumerate(rows):
        cells = []
        for j, value in enumerate(row):
            fill = '<w:shd w:fill="F2F4F7"/>' if i == 0 else ""
            bold = i == 0
            cell = (
                "<w:tc>"
                f'<w:tcPr><w:tcW w:w="{widths[j]}" w:type="dxa"/>{fill}'
                '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/>'
                '<w:start w:w="140" w:type="dxa"/><w:end w:w="140" w:type="dxa"/></w:tcMar>'
                "</w:tcPr>"
                f"<w:p><w:pPr><w:spacing w:after=\"60\"/></w:pPr>{run(value, bold=bold)}</w:p>"
                "</w:tc>"
            )
            cells.append(cell)
        rows_xml.append(f"<w:tr>{''.join(cells)}</w:tr>")
    return (
        "<w:tbl>"
        '<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="9360" w:type="dxa"/>'
        '<w:tblInd w:w="120" w:type="dxa"/><w:tblBorders>'
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>'
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>'
        "</w:tblBorders></w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        f"{''.join(rows_xml)}</w:tbl>"
    )


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Malgun Gothic"/><w:sz w:val="22"/><w:color w:val="17212B"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="180"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="0B2545"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="180"/></w:pPr><w:rPr><w:sz w:val="24"/><w:color w:val="667085"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1F4D78"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D5DD"/><w:left w:val="single" w:sz="4" w:color="D0D5DD"/><w:bottom w:val="single" w:sz="4" w:color="D0D5DD"/><w:right w:val="single" w:sz="4" w:color="D0D5DD"/><w:insideH w:val="single" w:sz="4" w:color="D0D5DD"/><w:insideV w:val="single" w:sz="4" w:color="D0D5DD"/></w:tblBorders></w:tblPr></w:style>
</w:styles>"""


def numbering_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>"""


def document_xml(body: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{NS['w']}" xmlns:r="{NS['r']}">
  <w:body>
    {body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>"""


def root_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def document_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""


def build_body() -> str:
    parts: list[str] = []
    parts.append(paragraph("제조 AX 품질관리 Agent 구현 현황 보고서", "Title"))
    parts.append(paragraph("개발계획서 대비 구현 범위, 검증 결과, 잔여 기능 로드맵", "Subtitle"))
    parts.append(table([
        ["항목", "내용"],
        ["작성일", "2026-05-18"],
        ["참고 원문", r"C:\Users\alsrl\Downloads\제조_AX_품질관리_Agent_개발계획서.docx"],
        ["현재 산출물", r"C:\workspaces\codex-workspace\backend, C:\workspaces\codex-workspace\frontend, C:\workspaces\codex-workspace\docs\frontend"],
        ["실행 확인", "Backend http://localhost:4000, Frontend http://localhost:3000"],
    ], [1900, 7460]))

    parts.append(heading("1. 종합 진행 현황", 1))
    parts.append(paragraph("현재 작업은 개발계획서의 MVP 흐름인 이미지 검사, 검사 이력, 대시보드, RAG 조치 Agent, 리포트 생성, 작업자 피드백의 웹 기반 데모를 프론트엔드와 백엔드 양쪽에서 실행 가능한 수준까지 구현한 상태이다."))
    parts.append(paragraph("다만 계획서에서 명시한 Supabase Auth/PostgreSQL/Storage/pgvector, 실제 Vision AI API, LangChain 기반 RAG, LLM 기반 리포트 생성은 아직 로컬 대체 구현 또는 UI 자리 확보 단계이다."))
    parts.append(table([
        ["구분", "현재 상태", "근거"],
        ["프론트엔드", "구현 완료(MVP 화면)", "Next.js App Router, TypeScript, Recharts, API client, 8개 라우트 200 응답"],
        ["백엔드", "구현 완료(MVP API)", "Node.js 내장 모듈 기반 API, 로컬 JSON 저장소, 업로드 이미지 제공"],
        ["데이터", "샘플 기준 충족", "2026-05-12~2026-05-18 검사 128건 seed 데이터"],
        ["검증", "기본 검증 통과", "backend npm test 3개 통과, frontend npm run build 성공"],
        ["AI/RAG", "대체 구현", "Vision AI와 RAG는 로컬 휴리스틱/기준서 매칭으로 동작"],
    ], [1500, 2500, 5360]))

    parts.append(heading("2. 개발계획서 기준 요구사항 요약", 1))
    for item in [
        "목표: Vision AI와 RAG Agent를 활용하여 불량 탐지, 조치 가이드, 리포트 생성을 통합한 제조 품질관리 웹 플랫폼 구현",
        "핵심 사용자: 현장 작업자, 품질관리자, 공정관리자",
        "핵심 가치: 검사 결과 데이터화, 불량 대응 시간 단축, 반복 불량 조기 발견, 품질 리포트 자동화",
        "주요 기술: TDD, Clean Architecture, Supabase, RAG, LangChain, Vision AI",
        "MVP 흐름: 이미지 업로드, AI 판정, 검사 이력 저장, 대시보드 갱신, Agent 체크리스트, 일일/주간 리포트 생성",
    ]:
        parts.append(paragraph(item, bullet=True))

    parts.append(heading("3. 현재 구현 산출물", 1))
    parts.append(heading("3.1 Backend", 2))
    for item in [
        "GET /api/health, GET /api/master-data",
        "POST /api/inspections/analyze: multipart 이미지 저장, 공정/설비/LOT 입력 검증, 로컬 휴리스틱 분석",
        "GET /api/inspections, GET /api/inspections/:inspectionId: 필터, 정렬, 페이지네이션, 상세 조회",
        "POST /api/inspections/:inspectionId/feedback: 판정 수정, 조치 내용, 재검사 결과 저장",
        "GET /api/dashboard/metrics: 전체 검사 수, 불량 수, 불량률, 최근 추이, 공정/설비 위험도, 불량 유형 분포",
        "POST /api/agent/ask: 로컬 기준서 매칭 기반 답변, 체크리스트, 출처, fallback 응답",
        "GET/POST /api/reports, GET /api/reports/:reportId: 일일/주간 리포트 생성 및 조회",
        "GET /api/manuals, GET /uploads/:fileName: 기준서 조회 및 업로드 이미지 제공",
    ]:
        parts.append(paragraph(item, bullet=True))

    parts.append(heading("3.2 Frontend", 2))
    parts.append(table([
        ["Route", "구현 내용"],
        ["/login", "mock 로그인 화면"],
        ["/dashboard", "KPI 카드, 불량률 추이 차트, 공정별 차트, 설비 위험도 테이블"],
        ["/inspections/new", "이미지 선택/미리보기, 공정/설비/LOT 입력, 분석 요청, 결과 패널"],
        ["/inspections", "검사 이력 테이블, 공정/설비/판정/상태 필터, 상세 이동"],
        ["/inspections/[inspectionId]", "검사 상세, AI 판정, 조치 체크리스트, 피드백 입력"],
        ["/agent", "불량 유형 기반 질문, Agent 답변, 체크리스트, 출처 표시"],
        ["/reports", "일일/주간 리포트 생성, 목록, 리포트 상세 보기"],
        ["/admin/manuals", "기준서 목록 조회, 업로드 기능 준비 상태 표시"],
    ], [2300, 7060]))

    parts.append(heading("4. 계획서 대비 구현 현황 매트릭스", 1))
    parts.append(table([
        ["요구 기능", "계획서 기준", "현재 구현", "판정", "남은 작업"],
        ["이미지 검사", "Vision AI API와 Storage 기반 정상/불량 및 유형 판정", "이미지 업로드, 저장, 로컬 휴리스틱 판정, 신뢰도 반환", "부분 완료", "Roboflow/Teachable Machine/Gemini Vision 등 실제 VisionModelClient 연동"],
        ["검사 이력 관리", "공정, 설비, LOT, 결과, 확률, 피드백 저장", "JSON store에 검사/피드백 저장, 필터 조회", "MVP 완료", "Supabase PostgreSQL 스키마, RLS, 운영 DB 마이그레이션"],
        ["품질 대시보드", "불량률, 유형 분포, 위험 공정/설비, 최근 추이", "최근 7일 기준 metrics와 Recharts 화면 구현", "MVP 완료", "이상 증가 탐지 기준 고도화 및 기간/공정 비교 강화"],
        ["RAG 조치 Agent", "LangChain, pgvector 기반 매뉴얼 검색 및 체크리스트", "로컬 기준서 점수화 매칭, 출처와 fallback 구현", "부분 완료", "문서 임베딩, 벡터 검색, LangChain Agent, hallucination guard"],
        ["AI 리포트 생성", "LLM/Report Agent 기반 일일/주간 리포트", "규칙 기반 요약, 위험 공정, 권장 조치 생성", "부분 완료", "LLM 요약, 근거 포함, PDF/DOCX 다운로드"],
        ["작업자 피드백", "AI 판정 수정, 실제 조치 결과, 재검사 결과 입력", "상세 화면과 API에서 저장/상태 변경 구현", "MVP 완료", "체크리스트 완료 처리, 피드백 기반 모델 개선 루프"],
        ["TDD 검증", "불량률, 위험도, fallback, 리포트 조건 테스트", "API 통합 테스트 3개 통과", "부분 완료", "도메인 단위 테스트, 프론트 테스트, 실제 AI/RAG mock 테스트"],
        ["권한/인증", "Supabase Auth, 역할별 접근 제어", "UI에 역할 표시는 있으나 인증/권한 미적용", "미구현", "로그인 세션, 역할별 navigation/route guard, RLS 정책"],
        ["Clean Architecture", "UI, UseCase, Domain, Infrastructure 계층 분리", "서비스 파일 단위 분리는 있으나 엄격한 계층 구조는 아님", "부분 완료", "UseCase/Repository/Client 인터페이스 분리 및 DI 적용"],
    ], [1450, 2100, 2100, 950, 2760]))

    parts.append(heading("5. 검증 결과", 1))
    for item in [
        "Backend: npm test 실행 결과 3개 테스트 모두 통과. 검사 이력/대시보드, 이미지 분석/피드백, Agent/리포트 흐름 검증.",
        "Frontend: npm run build 성공. Next.js 컴파일, 타입 검사, 정적 페이지 생성 성공.",
        "실행 확인: backend health API 정상 응답, frontend 주요 라우트 /dashboard, /inspections, /inspections/new, /agent, /reports, /admin/manuals, /login 모두 HTTP 200 응답.",
        "운영 리스크: npm install 결과 moderate 취약점 2건이 보고되었으며, breaking change 가능성 때문에 자동 수정은 보류.",
    ]:
        parts.append(paragraph(item, bullet=True))

    parts.append(heading("6. 현재 구현의 한계", 1))
    for item in [
        "AI 판정은 실제 학습 모델이 아니라 파일명, 메모, LOT, 이미지 해시 기반 로컬 규칙이다. 정확도 80% 목표를 평가할 수 있는 모델 검증 체계는 아직 없다.",
        "RAG는 벡터 검색이 아니라 소스 코드에 내장된 4개 기준서에 대한 문자열/유형 매칭이다.",
        "저장소는 Supabase가 아니라 로컬 JSON 파일이다. 동시성, 권한, 운영 데이터 보존, 백업 정책이 없다.",
        "로그인은 mock 화면이며 실제 인증, 세션, 역할별 권한 분리가 없다.",
        "매뉴얼 업로드, 임베딩 생성, PDF 리포트 다운로드, 체크리스트 완료 처리, 알림/감사 로그는 아직 구현되지 않았다.",
        "프론트엔드 E2E 테스트와 브라우저 기반 시각 QA는 HTTP/빌드 검증 수준에 머물러 있다.",
    ]:
        parts.append(paragraph(item, bullet=True))

    parts.append(heading("7. 향후 추가 기능 제안", 1))
    parts.append(heading("7.1 우선순위 1: 계획서 핵심 기술 실연 완성", 2))
    for item in [
        "VisionModelClient 인터페이스를 정의하고 Roboflow/Teachable Machine/Gemini Vision 중 하나를 실제 구현체로 연결한다.",
        "Supabase 프로젝트를 구성하고 Auth, PostgreSQL, Storage, pgvector를 도입한다.",
        "검사 이미지 저장을 Supabase Storage로 이전하고 검사/피드백/리포트/매뉴얼 테이블을 설계한다.",
        "LangChain 기반 RAG 파이프라인을 구축한다. 매뉴얼 업로드, chunking, embedding, pgvector 저장, top-k 검색, 출처 반환을 포함한다.",
        "RAG fallback 정책을 강화한다. 검색 score가 낮거나 출처가 없으면 조치 권고를 제한한다.",
    ]:
        parts.append(paragraph(item, number=True))

    parts.append(heading("7.2 우선순위 2: 업무 완성도 강화", 2))
    for item in [
        "역할별 UX: worker는 새 검사/이력 중심, manager는 대시보드/리포트 중심으로 기본 진입과 메뉴를 분기한다.",
        "체크리스트 완료 처리: 조치 항목별 담당자, 완료 여부, 완료 시각, 재검사 결과를 저장한다.",
        "리포트 다운로드: PDF/DOCX 다운로드, 기간별 자동 생성, 관리자 검토 상태를 추가한다.",
        "반복 불량 탐지: 최근 7일 평균 대비 1.5배 이상 증가, 설비별 급증, LOT 반복 패턴을 계산한다.",
        "모델 피드백 루프: 작업자 수정 판정과 실제 조치 결과를 학습 데이터 후보로 축적한다.",
    ]:
        parts.append(paragraph(item, number=True))

    parts.append(heading("7.3 우선순위 3: 품질 및 운영 준비", 2))
    for item in [
        "Clean Architecture 재정리: Domain, Application UseCase, Infrastructure Client/Repository, Presentation 계층을 명확히 분리한다.",
        "테스트 확대: 도메인 단위 테스트, API 계약 테스트, 프론트 컴포넌트 테스트, Playwright E2E를 추가한다.",
        "보안: Supabase RLS, 역할별 API 접근 제어, 파일 업로드 확장자/용량 제한, 감사 로그를 적용한다.",
        "배포: 프론트 Vercel 또는 Node 서버, 백엔드 API 배포, 환경변수, CI 빌드/테스트 파이프라인을 구성한다.",
        "관측성: API 로그, AI 응답 로그, fallback 비율, 리포트 생성 실패율, 업로드 실패율을 모니터링한다.",
    ]:
        parts.append(paragraph(item, number=True))

    parts.append(heading("8. 권장 다음 작업 순서", 1))
    parts.append(table([
        ["순서", "작업", "완료 기준"],
        ["1", "Supabase 스키마/Auth/Storage 설계", "테이블, RLS, Storage bucket, seed migration 작성"],
        ["2", "백엔드 저장소 추상화", "JsonStore와 SupabaseRepository를 교체 가능한 구조로 분리"],
        ["3", "실제 Vision AI 연동", "테스트 이미지 기준 정상/불량 및 유형 응답, 실패 fallback 처리"],
        ["4", "RAG 파이프라인 구현", "매뉴얼 업로드 후 Agent 답변에 실제 source와 score 표시"],
        ["5", "프론트 권한/상태 강화", "역할별 메뉴, route guard, loading/error/empty 상태 보강"],
        ["6", "리포트 다운로드와 데모 시나리오", "일일/주간 리포트 다운로드와 계획서 부록 시나리오 end-to-end 시연"],
    ], [900, 3100, 5360]))

    parts.append(heading("9. 결론", 1))
    parts.append(paragraph("현재 산출물은 계획서의 업무 흐름을 실제로 클릭하고 API로 실행할 수 있는 MVP skeleton을 완성한 상태이다. 특히 검사 업로드부터 대시보드, Agent, 리포트까지 하나의 제품 흐름으로 연결되었고, 128건 샘플 데이터와 기본 테스트를 통해 데모 안정성도 확보했다."))
    parts.append(paragraph("다음 단계의 핵심은 로컬 대체 구현을 계획서의 핵심 기술인 Supabase, 실제 Vision AI, LangChain RAG로 교체하는 것이다. 이 전환이 완료되면 단순 데모 앱을 넘어 개발계획서가 목표로 한 제조 품질관리 AX 플랫폼의 기술적 증거를 갖추게 된다."))
    return "\n".join(parts)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = build_body()
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml())
        zf.writestr("_rels/.rels", root_rels_xml())
        zf.writestr("word/_rels/document.xml.rels", document_rels_xml())
        zf.writestr("word/document.xml", document_xml(body))
        zf.writestr("word/styles.xml", styles_xml())
        zf.writestr("word/numbering.xml", numbering_xml())
    print(OUT.resolve())


if __name__ == "__main__":
    main()
