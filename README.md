# LendzDashboard — LendLogic Delivery Readiness Console

Internal, read-only executive dashboard showing delivery readiness across LendLogic modules.

## Stack

- **Frontend:** Vite + React + TypeScript (SPA)
- **Backend:** Vercel serverless function — `GET /api/readiness`
- **Data sources (phase 2):** Monday.com API (story status) + metrics DB (Bank Statement Analyzer KPIs)

## Docs

- `Readiness_Console_Implementation_Guide.md` — build guide (architecture, data mapping, composite logic)
- `docs/superpowers/specs/` — design specs
- `LendLogic_Readiness_Console.html` — original standalone PoC

## Roadmap

- **Phase 1:** scaffold + static `GET /api/readiness` + React render of all 7 module tabs.
- **Phase 2:** wire Monday.com (story rollups) and the metrics DB (Bank Analyzer composite) inside the function.
- **Phase 3:** access control (domain-restricted Google OAuth) gating the page and the endpoint.
