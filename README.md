# LendzDashboard — LendLogic Delivery Readiness Console

Internal, read-only executive dashboard showing delivery readiness across LendLogic modules.

## Stack

- **Frontend:** Vite + React + TypeScript (SPA)
- **Backend:** Node/Express server in a Docker container on Azure Container Apps — serves the SPA and `GET /api/readiness`
- **Storage:** Azure Blob Storage, accessed via Managed Identity (DefaultAzureCredential)
- **Data refresh:** scheduled Azure Container Apps Job (cron `*/15 * * * *`) that rebuilds the readiness payload
- **Data sources (phase 2):** Monday.com API (story status) + metrics DB (Bank Statement Analyzer KPIs)

## Docs

- `Readiness_Console_Implementation_Guide.md` — build guide (architecture, data mapping, composite logic)
- `docs/superpowers/specs/` — design specs
- `LendLogic_Readiness_Console.html` — original standalone PoC

## Roadmap

- **Phase 1:** scaffold + static `GET /api/readiness` + React render of all 7 module tabs.
- **Phase 2:** wire Monday.com (story rollups) and the metrics DB (Bank Analyzer composite) inside the function.
- **Phase 3:** access control (domain-restricted Google OAuth) gating the page and the endpoint.

## Deployment

- The Docker image is built and pushed to Azure Container Registry (ACR) by GitHub Actions on every push to `main`, then rolled out to Azure Container Apps.
- Infrastructure is provisioned via `infra/provision.sh` — see `infra/README.md` for details.
- Data refresh runs as a scheduled Container Apps Job; trigger it manually with `az containerapp job start`.
