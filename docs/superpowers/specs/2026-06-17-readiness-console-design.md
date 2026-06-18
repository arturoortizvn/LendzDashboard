# Design — LendLogic Readiness Console (v1 scaffold)

**Date:** 2026-06-17
**Status:** approved (brainstorming) — pending spec review
**Scope of this doc:** Phase 1 only. Phases 2 and 3 are described for context but are out of scope here.

## 1. Context and goal

Turn the standalone HTML proof of concept (`LendLogic_Readiness_Console.html`) into a deployable web app: a Vite + React + TypeScript SPA backed by a Vercel serverless function at `GET /api/readiness`. The dashboard is an internal, **read-only** executive view of delivery readiness across seven LendLogic modules.

The architecture follows `Readiness_Console_Implementation_Guide.md`: two source systems feed one thin backend endpoint that owns the business logic; the frontend is a dumb renderer of the endpoint payload.

## 2. Scope

**Phase 1 (this spec):**
- Vite + React + TypeScript SPA.
- One Vercel serverless function, `GET /api/readiness`, returning the **current PoC numbers as a static JSON payload** plus an `asOf` timestamp.
- React renders all seven module tabs from that payload, matching the PoC visually (ported CSS).
- Loading and error states.
- Deployable to Vercel (Hobby) behind an unguessable URL with `noindex`.
- Vitest + React Testing Library coverage on the components and the API client.

**Out of scope (later phases, noted for context):**
- **Phase 2:** wire Monday.com GraphQL (story rollups) and the metrics DB (Bank Analyzer composite) inside the function. Requires the Monday API token and DB credentials.
- **Phase 3:** access control — domain-restricted Google OAuth (`@viewnear.com`) gating both the page and the endpoint.

**Non-goals:** no writes, no per-user data, no router (tabs are local state), no BI tool, no realtime.

## 3. Architecture and stack

```
Browser (React SPA) ──fetch──► GET /api/readiness (Vercel function) ──► ReadinessPayload (v1: static fixture)
```

- **Frontend:** Vite + React + TypeScript SPA.
- **Backend:** a single Vercel serverless function (Node runtime, TypeScript) at `api/readiness.ts`.
- **Single repo, single deploy** on Vercel. The function and SPA ship together; no CORS.

The frontend never knows the data sources. In phase 2, only the function changes (it starts fetching from Monday + DB); the contract and the frontend stay the same.

**On "no Vercel Pro":** not a blocker. Vercel Hobby is free; v1 deploys behind an unguessable URL + `noindex`. The v1 payload is the already-shared static snapshot, so this is acceptable. Real auth (free Google OAuth in the function) lands in phase 3 before any live internal data is exposed — no Pro Password Protection needed.

## 4. Repo structure

```
api/
  readiness.ts            # Vercel serverless function — returns ReadinessPayload (v1: static)
shared/
  readiness.ts            # contract types + the static fixture payload (imported by api/ and tests)
src/
  main.tsx
  App.tsx                 # fetch on mount; loading / error / ok states
  api.ts                  # typed fetch('/api/readiness')
  components/
    Masthead.tsx          # brand + asOf timestamp
    Tabs.tsx              # one tab per module (name + percent)
    DeliveryPanel.tsx     # phase: "delivery" — 3-number row + 3 buckets
    MeasurementPanel.tsx  # phase: "measurement" (bank) — composite + 4/6 + metrics table + buckets
    BucketColumn.tsx      # Delivered / In Progress / Remaining (or Achieved/Holding/Must Complete)
    MetricsTable.tsx      # bank KPI table with sentinels ("Not emitted", "Measured / TBD")
    ProgressBar.tsx       # animated fill (ports the data-w animation)
    InfoTooltip.tsx       # the circular "i" hover/focus tooltip
    AssumedBadge.tsx      # amber badge for assumed modules
  styles/
    tokens.css            # Lendz palette as CSS variables
    app.css               # PoC styles ported verbatim
index.html
vite.config.ts
vercel.json               # SPA fallback + noindex header
tsconfig.json
package.json
```

`shared/readiness.ts` is the single source of truth for the contract types and the v1 fixture. The function imports the fixture from it; tests import the types/fixture. The browser only ever receives the payload over HTTP.

## 5. Data contract — `GET /api/readiness`

Reuses the shape from the implementation guide §2.1. `Module` is a discriminated union on `phase`.

```typescript
export interface ReadinessPayload {
  asOf: string;                  // ISO timestamp
  modules: Module[];
}

export type Module = DeliveryModule | MeasurementModule;

export type Phase = "delivery" | "measurement";
export type Status = "on_track" | "in_progress" | "early" | "at_risk" | "blocked";
export type DateConfidence = "committed" | "projected";

export interface BucketItem {
  title: string;
  detail?: string;
  weight?: number;               // bank capabilities surface their weight
}

export interface DeliveryModule {
  key: string;                   // "pe" | "vt" | "uw" | "lexi" | "id" | "tax"
  name: string;
  phase: "delivery";
  percent: number;
  status: Status;
  statusLabel: string;           // "On track" | "In design" | "Early build" ...
  targetDate: string;            // ISO date or free text ("mid-August")
  dateConfidence: DateConfidence;
  assumed: boolean;              // true for vt, id, tax
  accentColor?: string;          // per-module bar color from the PoC
  counts: { delivered: number; inProgress: number; remaining: number };
  buckets: {
    delivered: BucketItem[];
    inProgress: BucketItem[];
    remaining: BucketItem[];
  };
}

export interface Metric {
  capability: string;
  weight: number;
  current: string;               // "93.8%" | "Not emitted" | "Measured / TBD"
  target: string;                // "95%" | "90% / 80%" | "TBD"
  status: "at_target" | "near" | "blocked" | "no_target";
}

export interface MeasurementModule {
  key: "bank";
  name: string;
  phase: "measurement";
  percent: number;               // composite
  status: Status;
  statusLabel: string;
  targetDate: string;
  dateConfidence: DateConfidence;
  capabilitiesAtStandard: { count: number; of: number };  // "4 of 6"
  composite: { value: number; denominator: number; costExcluded: boolean };
  gapNote: string;               // the "gap to 100" sentence
  metrics: Metric[];
  buckets: {
    achieved: BucketItem[];
    holding: BucketItem[];
    mustComplete: BucketItem[];
  };
}
```

TypeScript guarantees the function and frontend stay in sync. The fixture values come from the current PoC: PE 71% (53/75), VT 55% (assumed), UW 69% (9/13), Lexi 55% (11/20), Bank 77% composite, ID 30% (assumed), Tax 30% (assumed); team-committed dates per module.

## 6. Data flow (v1)

1. `App` mounts → calls `api.ts` → `fetch('/api/readiness')`.
2. Three states: **loading** (skeleton), **error** (clear error card), **ok** (render).
3. On ok: render `Masthead` (with `asOf`), `Tabs` (one per module showing name + percent), and the active panel.
4. Active panel selected by local state; rendered by `phase`: `delivery` → `DeliveryPanel`, `measurement` → `MeasurementPanel`.
5. `ProgressBar` animates its fill on mount and on tab change (ports the PoC `data-w` 0→N transition).

## 7. Components

Each component has one purpose and renders from props (no data fetching except `App`):

- **Masthead** — brand block + `asOf`.
- **Tabs** — maps `modules` to tab buttons; emits the selected key; highlights active.
- **DeliveryPanel** — module header (name, sub, target date, optional AssumedBadge), the three-number row (progress + ProgressBar, in-progress, remaining), and three `BucketColumn`s.
- **MeasurementPanel** — bank-only: composite tile + capabilities-at-standard tile, gap note strip, three `BucketColumn`s (Achieved/Holding/Must Complete), and the expandable `MetricsTable`.
- **BucketColumn** — colored header + list of `BucketItem`s (title bold, optional detail, optional weight chip).
- **MetricsTable** — capability rows with weight, current, target, status; renders sentinels for "Not emitted" / "Measured / TBD"; header tooltips via `InfoTooltip`.
- **ProgressBar** — animated fill, accepts percent + color.
- **InfoTooltip** — circular "i", hover/focus, left-flip near the right edge.
- **AssumedBadge** — amber "assumed/architecture phase" marker.

## 8. Error handling and special states

- **Loading:** lightweight skeleton, not a blank page.
- **Fetch failure:** an explicit error card with a retry affordance; never a white screen.
- **Bank sentinels:** `MetricsTable` renders "Not emitted" (blocked capability, no number) and "Measured / TBD" (data exists, no target) instead of fake percentages.
- **Assumed modules:** vt/id/tax always render the AssumedBadge and the "figures assumed" note so the dashboard stays honest.

## 9. Testing strategy (TDD: red → green → refactor)

Vitest + React Testing Library. The implementer writes and runs the tests.

- `Tabs`: renders one tab per module; clicking switches the active panel.
- `DeliveryPanel`: renders percent, counts, and the three buckets with their items.
- `MeasurementPanel`: renders composite, "4 of 6", and the metrics table including sentinel states.
- `AssumedBadge`: present for vt/id/tax, absent for the rest.
- `api.ts`: success parses a valid payload; failure surfaces an error state.
- A shape check that the static fixture in `shared/readiness.ts` satisfies the contract types.

## 10. Deploy and auth phasing

- **v1:** Vercel Hobby, unguessable URL, `noindex` header via `vercel.json`. Acceptable because the v1 payload is the already-shared static snapshot.
- **Phase 3 (before live internal data):** domain-restricted Google OAuth via Auth.js running in a Vercel function, gating the page **and** `/api/readiness`. Free; fits Viewnear's Google Workspace; named logins. Confirm Viewnear's preferred auth and which Google project before provisioning (work-project rule).

## 11. Git and workflow

- Repo: `arturoortizvn/LendzDashboard` (private). Bootstrap commit on `main`; `develop` as integration base.
- All Phase 1 work on `feature/scaffold-readiness-console`.
- Merges to `develop`/`main` require explicit user confirmation.
- No secrets committed; `*.pdf` and `Meeting_Notes_*.md` are gitignored.

## 12. To confirm before Phase 2 (not blocking v1)

- Monday API token and which account/board it belongs to (guide §3: board `18402839374`).
- Metrics DB read access and the exact table/column names for the six Bank Analyzer KPIs.
- Whether the three assumed modules (VT/ID/Tax) stay config-driven or their stories land on the board.
