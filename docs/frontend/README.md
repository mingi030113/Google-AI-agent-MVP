# Frontend Design Blueprint

이 문서는 제조 품질관리 Agent 플랫폼의 프론트엔드 구현 기준이다.
백엔드와 프론트엔드를 분리해서 개발하기 위해 화면 구조, 사용자 역할, API 계약, 상태 모델을 먼저 고정한다.

## Product Scope

MVP는 수동 이미지 업로드 기반 품질검사 흐름을 제공한다.

```text
로그인
→ 이미지 업로드 및 검사 정보 입력
→ Vision AI 검사 결과 확인
→ 작업자 피드백 입력
→ 검사 이력 조회
→ 대시보드 확인
→ RAG Agent 조치 가이드 확인
→ 품질 리포트 생성
```

## User Roles

| Role | Korean Name | Primary Job |
|---|---|---|
| `worker` | 현장 작업자 | 검사 이미지 업로드, 검사 결과 확인, 판정 수정, 조치 결과 입력 |
| `quality_manager` | 품질관리자 | 불량률 분석, 검사 이력 검토, 품질 리포트 생성, 매뉴얼 관리 |
| `process_manager` | 공정관리자 | 위험 공정/설비 확인, 반복 불량 원인 추적, 공정 개선 의사결정 |
| `admin` | 관리자 | 사용자/권한/기준 데이터 관리 |

## Recommended Stack

| Area | Recommendation |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI | shadcn/ui or local component system |
| Chart | Recharts |
| Form | React Hook Form + Zod |
| API Client | typed fetch wrapper |
| Auth State | Supabase Auth session |

## Frontend Directory Target

```text
src/
  app/
    (auth)/
      login/
    (app)/
      layout.tsx
      dashboard/
      inspections/
        page.tsx
        new/
        [inspectionId]/
      agent/
      reports/
      admin/
        manuals/

  components/
    layout/
    inspections/
    dashboard/
    agent/
    reports/
    manuals/
    common/

  features/
    inspections/
      api.ts
      types.ts
      hooks.ts
    dashboard/
    agent/
    reports/
    manuals/

  lib/
    api/
      client.ts
      errors.ts
    auth/
      permissions.ts
    format/

  mocks/
    inspections.ts
    dashboard.ts
    reports.ts
```

## Navigation

| Route | Label | Roles |
|---|---|---|
| `/login` | 로그인 | public |
| `/inspections/new` | 새 검사 | worker, quality_manager |
| `/inspections` | 검사 이력 | worker, quality_manager, process_manager |
| `/inspections/:inspectionId` | 검사 상세 | worker, quality_manager, process_manager |
| `/dashboard` | 대시보드 | quality_manager, process_manager |
| `/agent` | 조치 Agent | worker, quality_manager, process_manager |
| `/reports` | 리포트 | quality_manager, process_manager |
| `/admin/manuals` | 매뉴얼 관리 | quality_manager, admin |

## MVP Implementation Order

1. App shell: sidebar, header, role-aware navigation.
2. Login page and mocked session state.
3. Inspection upload page with form validation.
4. Inspection result detail page using mock response.
5. Inspection history table.
6. Dashboard cards and charts.
7. Agent Q&A panel with source display.
8. Report list and report detail/generate flow.
9. Replace mocks with backend API client.

