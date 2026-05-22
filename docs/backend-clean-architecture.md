# Backend Clean Architecture Notes

## Current Layering

The backend now follows a pragmatic Clean Architecture direction:

- `src/app.js`
  - HTTP interface layer.
  - Parses requests, validates transport-level concerns, and maps use-case results to HTTP responses.
- `src/application/use-cases/*`
  - Application layer.
  - Coordinates domain services, repositories, AI clients, and persistence for each user workflow.
- `src/application/ports/*`
  - Port contracts.
  - Documents and validates required repository capabilities.
- `src/infrastructure/container.js`
  - Composition root.
  - Wires concrete repositories and AI clients into the application.
- Existing service modules such as `inspection-service.js`, `agent-service.js`, `report-service.js`
  - Domain/application logic used by the use-case layer.
- `src/repositories/*`, `src/vision/*`, `src/agent/*`, `src/report/*`
  - Infrastructure adapters for persistence and external AI providers.

## Dependency Direction

The intended dependency direction is:

```txt
HTTP interface -> application use-cases -> domain/application services -> ports
                                                ^
                                                |
                              infrastructure adapters are wired by container
```

The HTTP router should not directly depend on Supabase, JSON storage, Gemini, or low-level persistence details.

## Benefits

- Route handlers stay focused on request/response handling.
- Use-cases are easier to test without an HTTP server.
- Storage and AI providers can be replaced behind the same application workflows.
- Business workflows such as inspection analysis, Agent answers, report generation, and manual ingestion have clearer ownership.
- Future refactors can move legacy service modules into stricter `domain` and `application` folders incrementally without changing API behavior.
