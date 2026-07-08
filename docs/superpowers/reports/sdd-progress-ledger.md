# SDD progress ledger — Readiness Console v1

Branch: feature/scaffold-readiness-console
Plan: docs/superpowers/plans/2026-06-17-readiness-console-scaffold.md

Task 1: complete (commits 527d0b1..100fa15, review clean)
  - Minor (deferred to Task 4): @vercel/node transitive audit advisories (tar@6/glob@7/rimraf@3), not reachable in SPA/test pipeline.
Task 2: complete (commits 0a51247..c3a87d3 incl. fix, re-review RESOLVED)
  - Fixed (Important): removed duplicate .assumed/.wt rules that overrode PoC verbatim values.
  - Minor (for final review): styles.test.ts only checks class presence, not values; consider a value spot-check.
Task 3: complete (commits ddddcaf..fd6578b incl. fix, review RESOLVED)
  - Fixed (Important): added assumedLabel 'Scaffolding done' to id and tax (PoC badge, was missing).
  - DECISION (user): bank metric current values kept per brief ('p95 99s', 'Measured / TBD') NOT aligned to PoC ('~99s','Measured'). Rationale: fixture is a placeholder; real data will come from a Monday API in phase 2. Leave wiring ready; do not re-flag these in final review.
Task 4: complete (commit 8cb7782, review APPROVED)
  - Resolved (⚠️): @vercel/node is a type-only `import type`, erased at build; devDependency placement is correct, Vercel runtime provides req/res. Not a deploy risk.
  - Minor (for final review): vercel.json has no "version" field (defaults to v3, fine on current CLI); mock setHeader cast `as VercelResponse` is slightly over-broad (inherited from plan).
Task 5: complete (commit 3337ddc, review APPROVED)
  - Minor (for final review): api.test.ts success path doesn't assert the fetch URL; error path matches /500/ not the full message. Coverage tightening, not defects.
Task 6: complete (commit 342a8eb, review APPROVED)
  - Minor (for final review): leaf.test.tsx has no coverage for InfoTooltip flipLeft branch (the only conditional in the diff).
Task 7: complete (commits 8abdb64..c2b9a92 incl. fix, review APPROVED)
  - Fixed (Important): count guard `count &&` -> `count != null` so a "0"/empty count string still renders (matches the weight-chip != null idiom; readies wiring for live Monday counts). Deviates from brief's literal code by realizing its stated intent ("render when provided"); test still green.
  - Minor (for final review): BucketColumn.test.tsx covers only title/count/title text; no case for weight chip (incl. weight=0), no-count path, or detail leading space.
Task 8: complete (commit e90de2b, review APPROVED)
  - Minor (for final review): MetricsTable.test.tsx doesn't assert the at_target/'At target' row (ok pill path untested); STATUS_CLASS exhaustiveness is type-checked though.
Task 9: complete (commit 42cc047, review APPROVED)
  - Minor (for final review): Masthead's toLocaleString() date is locale/tz-dependent and untested (CI-stable since test only checks brand); Tabs test fixture uses broad `as unknown as Module[]` cast (per brief).
Task 10: complete (commit 16fc0dd, review APPROVED)
  - Test deviation (validated): brief's getByText('Remaining') collides (card label + bucket title both "Remaining"); changed to getAllByText(...).toHaveLength(2). Correct fix, not a weakening. Card "In progress" (lowercase) does NOT collide with bucket "In Progress".
  - Minor (for final review): single test fixture has assumed:false and no accentColor, so the AssumedBadge path and inline borderLeftColor/ProgressBar color path are unexercised (in-spec: brief mandated one test).
Task 11: complete (commit c4a2af3, review APPROVED)
  - Minor (for final review): test doesn't assert the 'On track' statusLabel (pill amber span untested); no test-query collision occurred.
Task 12: complete (commits a876093..b4b2408 incl. fix, review APPROVED)
  - Test deviation (validated): brief's getByText('Pricing & Eligibility') collides (name in tab button + panel mtitle). Implementer used getAllByText; fix strengthened it to toHaveLength(2) to pin both occurrences. Key behaviors (tab switch -> 'Capabilities at standard'; error card) intact.
  - Fixed (Important): load assertion >= 1 -> toHaveLength(2).
  - Minor (for final review): kept a one-line why-comment in App.test.tsx (allowed); `const active = ...find(...)!` non-null assertion is plan-mandated (invariant holds: activeKey always from modules[]); a runtime guard would be more defensive.

Final verification (controller, post-Task-12):
  - BUILD BUG FOUND + FIXED (commit 5cd89bc): `npm run build` (tsc -b && vite build) failed — TS6306/TS6310: tsconfig.node.json referenced by root must be composite, and composite forbids noEmit. Latent since Task 1 (only `npm test`/`npm run dev` were ever run, both bypass tsc -b). Not a regression (build never worked; nothing to revert). Made tsconfig.node composite + emitDeclarationOnly to node_modules/.tmp; gitignored *.tsbuildinfo. Build now green; full suite 19/19; dist bundles.
  - Verified: `npm run build` OK (39 modules, dist/ emitted), `npx vitest run` 19/19, working tree clean (no stray artifacts).

Whole-branch final review (opus, package .git/sdd/final-review-527d0b1..HEAD.diff, product code only):
  - Verdict: Ready to merge with (optional) fixes. NO Critical, NO Important. Architecture/data-seam/discriminated-union/security/build-fix all sound.
  - Acted on highest-value gap: added BucketColumn weight-chip (incl. 0) + count-omission regression tests (commit d13de3c). Suite now 21/21.
  - Deferred (acceptable v1 follow-ups): api.test URL/message assertions; InfoTooltip flipLeft; MetricsTable at_target row; Masthead locale date; DeliveryPanel AssumedBadge/accentColor paths; MeasurementPanel On track pill; App find()! (plan-mandated).
  - PLAN-LEVEL deviations from "ported verbatim" (in the plan, not the code) — FOR USER DECISION / phase 2: PoC has 9 info tooltips, MetricsTable renders 1 (Current header); Masthead shows "as of <localeString>" vs PoC "Snapshot 16 June 2026 · Target window: mid-July"; PoC .foot disclaimer line dropped (CSS ported but unused) — its "figures assumed" caveat is now conveyed per-module via assumed badges. MeasurementPanel hardcodes pill amber (status field unused in UI; matches PoC).

Final state (pre-deploy): Tasks 1-12 complete + build fix + final-review test. 21/21 tests, build green, no secrets.

Task 13 (deploy + manual verification) — 2026-06-18:
  - Branch merged feature -> develop -> main (user OK), pushed to origin; Vercel project linked (lendz-dashboard).
  - DECISION (user): disabled Vercel Deployment Protection (SSO) so v1 matches the spec model (unguessable URL + noindex, no auth until phase 3). `vercel project protection disable --sso`. Real auth lands in phase 3.
  - DEPLOY BUG FOUND + FIXED on branch fix/api-readiness-deploy (commit 594c9a4): live `GET /api/readiness` returned 500 (ERR_MODULE_NOT_FOUND) because the ESM runtime needs explicit file extensions; `api/readiness.ts` imported '../shared/readiness' without `.js`. Vitest/tsc tolerate it, so it only surfaced on the real Vercel runtime. Latent scaffold bug (deploy never worked) — fixed forward, not reverted, same as the earlier tsc -b build fix. Also added .vercelignore: Vercel was deploying api/readiness.test.ts as a bogus /api/readiness.test function. Added a regression test (relative imports must carry .js). Suite 22/22.
  - Verified live (preview, prebuilt deploy): `GET /` 200 + X-Robots-Tag noindex; `GET /api/readiness` 200 application/json with 7 modules in PoC order + bank composite 77/97; `/api/readiness.test` now 404. `npm run build` green; `npx vitest run` 22/22.
  - Merged fix -> develop -> main (user OK), pushed; promoted to production (user OK): `vercel --prod`. Production verified live on the stable alias https://lendz-dashboard.vercel.app — `GET /` 200 + noindex, `GET /api/readiness` 200 application/json with 7 modules, `/api/readiness.test` 404.

PHASE 1 CLOSED — 2026-06-18: Tasks 1-13 complete, all merged to main and live in production. 22/22 tests, build green, no secrets. Stale branch feature/scaffold-readiness-console deleted (local + remote) after full merge. Next: phase 2 (live Monday + metrics DB behind the same /api/readiness contract) is blocked on external inputs — Monday API token/account + board 18402839374, metrics DB read access + the six Bank Analyzer KPI table/columns, and the VT/ID/Tax config-vs-board decision. See memory deployment-reference and readiness-data-source-roadmap.

---

# PHASE 2a — Live Monday connector (delivery modules) — CLOSED 2026-06-19

Spec: `docs/superpowers/specs/2026-06-18-phase2-monday-connector-design.md` · Plan: `docs/superpowers/plans/2026-06-18-phase2-monday-connector.md` · Branch: `feature/phase2-monday-connector` (merged). Full task-by-task controller detail: `.git/sdd/progress.md` (local).

**DEPLOYED & LIVE in production:** https://lendz-dashboard.vercel.app (`GET /api/readiness` → `source:live`). Built subagent-driven: 7 TDD tasks + per-task reviews + whole-branch review (opus) + fixes; then live deploy.

**Scope:** replaced the static delivery-module numbers with a live Monday rollup behind the unchanged `GET /api/readiness` contract. Bank Analyzer stays fixture (Phase 2b).

**Architecture:** Vercel Cron (every 15 min) → `CRON_SECRET`-guarded `/api/refresh` → Monday GraphQL (board `18402839374`, "Module" status column `color_mm4e3r3v`) → status→bucket rollup per module → assemble payload → write **Vercel Blob** `readiness-lkg` (public, last-known-good). `GET /api/readiness` only reads the Blob; config-baseline fallback when empty. Monday token lives only on the cron path. Failure modes: a cron Monday-failure does not overwrite the Blob; the request never 500s on a missing Blob.

**Live result (validated 2026-06-19):** pe 53% / uw 62% / lexi 50% computed live from the board; vt 55% / id 30% / tax 30% **force-assumed** (`FORCE_ASSUMED` set — agreed figures + badge) per guide §3.3 until their stories are fully tracked; bank 77% fixture. 51/51 tests, `npm run build` green.

**Key decisions / findings:** the board had no reliable module dimension (47% epic coverage, 0 tax) → added a Monday **"Module" column** as the mapping contract (prefix/epic rejected); **items-live** (bucket items = real story titles by status); **last-known-good in Vercel Blob**; **cron rebuild + request-reads-Blob**; **Vercel Pro** for 15-min crons. Real board labels differ from the v1 guesses (`Pricing and Eligibility`, `Lexi Intelligence`, `Tax Analyzer`) — caught + fixed before deploy.

**Refs at close:** `main` = `origin/main` = `671175a` (= what's deployed in production); `develop` = `origin/develop` = `f3fca0e` (release + review follow-up cleanups, not yet deployed — reach main/prod on the next deploy).

**OPEN (resolved since close):**
1. **Rotate `MONDAY_API_TOKEN`** — DONE 2026-06-19 (rotated). ⚠️ confirm the new value is the one set in Vercel and that a redeploy carried it — the cron `/api/refresh` reads it.
2. **Bank Analyzer from the metrics DB** — DESCOPED: it tracks the product's data source, not dashboard build work; the interim Analyzers-board approach shipped instead (Phase 2B below). Roadmap: memory `readiness-data-source-roadmap`.

---

# PHASE 3 — Clerk invite-only access control — CLOSED 2026-06-19

Spec: `docs/superpowers/specs/2026-06-18-phase3-auth-design.md` · Plan: `docs/superpowers/plans/2026-06-18-phase3-auth.md` · Commits `43f07d9..20543b1` (feature branch merged & deleted).

**DEPLOYED & LIVE in production:** https://lendz-dashboard.vercel.app — verified `GET /api/readiness` → `401 unauthorized` without a Bearer token (the gate is live).

**Scope:** locked the dashboard behind invite-only Clerk auth. `/api/readiness` verifies the Clerk session token (`@clerk/backend` `verifyToken`, `api/_lib/auth.ts`); the SPA is wrapped in the Clerk provider + an invite-only AuthGate and sends the token on every fetch. The readiness Blob is stored privately and read with the token. The API checks the token's authorized party (`azp`) against an origin allowlist (`CLERK_AUTHORIZED_PARTIES`), with the deployment's own origins always allowed.

**Env (Vercel):** `CLERK_SECRET_KEY` (Prod+Preview), `VITE_CLERK_PUBLISHABLE_KEY` (Prod+Preview, public by design), `CLERK_AUTHORIZED_PARTIES` (Production only — empty disables the allowlist, so it is OFF in Preview).

---

# PHASE 2B — Analyzer modules live from the Analyzers board — CLOSED 2026-06-19

Spec: `docs/superpowers/specs/2026-06-19-phase2b-analyzers-connector-design.md` · Plan: `docs/superpowers/plans/2026-06-19-phase2b-analyzers-connector.md` · Commits `957c555..9d95f0b` (feature branch merged & deleted).

**Scope:** wired `bank`/`id`/`tax` to live data from the "Workstream: Analyzers" board (`18403908550`) via a single-select **"Module"** status column (`color_mm4f6wz7`, labels `Bank`/`ID`/`Tax`/`Shared`/`-`), behind the unchanged `GET /api/readiness` contract. Converted `bank` from a measurement module to a delivery module (removed `Metric`/`MeasurementModule`/`MeasurementPanel`/`MetricsTable`). Generalized `fetchBoardStories` with `statusColumnId` + optional `moduleColumnId`; the cron now fetches both boards (Stories + Analyzers) and assembles one payload. The `Shared` label counts toward bank/id/tax.

**Key decisions:** pivoted the source from the Metrics board to the Analyzers board (the original metrics-DB approach was dropped). `FORCE_ASSUMED` reduced to `{ vt }` — bank/id/tax compute live; `vt` stays force-assumed until its stories are tracked. 69/69 tests, `npm run build` green.

**Env (Vercel):** `ID_MONDAY_ANALYZERS` + `MONDAY_ANALYZER_COLUMN_ID` set in Prod+Preview; `ID_MONDAY_METRICS` removed.

**OPEN — both resolved 2026-06-19:**
1. **Redeploy to activate `MONDAY_ANALYZER_COLUMN_ID`** — DONE: redeployed (`vercel --prod`); bank/id/tax compute live on the next cron rebuild (not directly re-verified — `/api/readiness` is auth-gated and `CRON_SECRET` is cron-only).
2. **Remove `vt` from `FORCE_ASSUMED`** — DONE: `FORCE_ASSUMED` is now empty, so Verified Truth computes live like every other module. Its 4 Stories-board tickets (Module `color_mm4e3r3v` = `Verified Truth`) are all not-started, so vt reads ~0% (Early build) until they progress.

---

# Build log on Monday — 2026-06-19

The dashboard's dev work is mirrored in Monday board `18418615318` ("Lendz Dashboard — Build Log"): phases as items, SDD tasks as subitems, status reflecting production. Created in the **Viewnear** workspace as a fallback (no create rights in LendLogic); **pending a move to LendLogic** (`14566706`). See memory `monday-build-log-board`.

---

# PHASE 3 — Clerk auth — RETIRED 2026-06-22

Spec: `docs/superpowers/specs/2026-06-22-remove-auth-design.md` · Plan: `docs/superpowers/plans/2026-06-22-remove-auth.md` · Branch: `feature/remove-auth`.

**Reason:** the dashboard exposes no private data (all figures are already visible to anyone on the project); the Clerk gate added friction and operational overhead without a meaningful security benefit.

**Removed:**
- Client gate: `ClerkProvider` / `AuthGate` wrappers in `main.tsx` and `App.tsx`.
- `/api/readiness` token check + `401 unauthorized` response (`@clerk/backend` `verifyToken`, `api/_lib/auth.ts`).
- npm packages `@clerk/backend` and `@clerk/clerk-react`.
- Clerk env vars `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`.

**Kept:** `CRON_SECRET` on `/api/refresh` (protects the write path from unsolicited rebuilds — unrelated to user auth).

**History preserved:** the Phase 3 spec (`docs/superpowers/specs/2026-06-18-phase3-auth-design.md`) and plan (`docs/superpowers/plans/2026-06-18-phase3-auth.md`) are intentionally retained as historical record of the Clerk implementation.

**Manual follow-ups (owner):**
1. Remove the three Clerk env vars from Vercel (Preview + Production): `vercel env rm VITE_CLERK_PUBLISHABLE_KEY`, `vercel env rm CLERK_SECRET_KEY`, `vercel env rm CLERK_AUTHORIZED_PARTIES`.
2. Deactivate (or delete) the Clerk application in the Clerk dashboard.

---

# PHASE 4 — Per-analyzer Monday boards + Analyzers overview — IN PROGRESS

Branch: `feature/analyzer-boards-overview` · Spec: `docs/superpowers/specs/2026-07-08-analyzer-boards-overview-design.md`

## 2026-07-08 — Per-analyzer Monday boards + Analyzers overview

- Bank/ID/P&L/Paystub each read a dedicated Monday board (whole board = one
  analyzer, no module routing); env-overridable ids.
- Tax unchanged: shared board 18403908550, module='Tax Analyzer'.
- Added P&L and Paystub analyzer modules; payload now 9 modules.
- SPA nav is two-tier: delivery modules + an Analyzers section with an
  Overview (story-weighted global %) and one sub-tab per analyzer.
- Spec: docs/superpowers/specs/2026-07-08-analyzer-boards-overview-design.md
- Deploy check: PENDING manual verification at deploy time — confirm the prod
  MONDAY_API_TOKEN can read the four new boards via a /api/refresh 200.

## 2026-07-08 — Resilient per-module boards (fix)

- The old combined Monday boards (Stories `18402839374`, shared Analyzers
  `18403908550`) were decommissioned in Carlos's per-module migration, so
  `/api/refresh` 500'd (blob frozen since 2026-07-07, all `assumed`).
- Unified every module onto its own dedicated board (`MODULE_BOARDS` map +
  `boardBackedKeys()`), read whole with `task_status` — removed all `module`
  column routing.
- Resilience: per-board `catch` → a failed/missing board falls back to baseline;
  only 500 (preserving the last-good blob) when EVERY board fetch fails.
- Modules whose board does not exist yet (vt/lexi/tax) are hidden from the
  payload; they reappear automatically when their board id is set in config/env.
- Visible now: pe, uw, bank, id, pl, paystub. Suite 64/64, build clean,
  whole-branch review = merge-ready.
- Spec/plan: docs/superpowers/{specs,plans}/2026-07-08-refresh-resilient-per-module-boards*

---

# PHASE 5 — Monday sub-tasks visible in the dashboard (display-only) — 2026-07-08

Branch: `feature/monday-subtasks-visibility` · Spec: `docs/superpowers/specs/2026-07-08-monday-subtasks-visibility-design.md` · Plan: `docs/superpowers/plans/2026-07-08-monday-subtasks-visibility.md`

**Scope:** Monday sub-items now surface nested under their parent story in each bucket card, read-only, with a per-sub-task status dot (green/amber/red/grey) and a `X/Y done` roll-up. **Display-only:** sub-tasks never change a module's `percent`/`counts` (locked by a differential rollup test).

**Pipeline:** `fetchBoardStories` GraphQL now pulls `subitems { name column_values(ids:["status"]) }` (sub-item status column is `status`, distinct from the parent `task_status`) → `RawStory.subtasks` → `buildDeliveryModule` attaches cleaned sub-tasks to each `BucketItem` (code prefix like `U-02-ID-01:` stripped) → `BucketColumn` renders the nested list. Sub-task status→dot-tone/done derived in `src/lib/subtaskStatus.ts` (front-end, mirrors `statusPill.ts`). Sub-item boards use Monday default labels (`Working on it`/`Done`/`Stuck`/unset), a subset of the existing `STATUS_BUCKET` map.

**Adoption note:** sub-tasks are sparse today — populated on the ID Analyzer (`U-02-ID`, 10 sub-items) and Underwriting (`U-05-W2`, `U-05-1099`, 7 each) boards; PE/Bank have the column but empty. Value grows as teams populate sub-tasks.

**Built subagent-driven:** 5 TDD tasks + per-task reviews + one a11y fix (status dots got `role="img"` + `aria-label`, empty→`No status`) + whole-branch review (opus). Commits `fd5b1eb..a45f3e1`. Suite 73/73, `npm run build` clean, all commits carry the session trailer.

**Whole-branch review (opus): Ready to merge = YES** — no Critical/Important. Minor follow-ups (non-blocking): `SubtaskTone` duplicates BucketColumn's non-exported `Tone`; `.subroll` CSS duplicates `.wt`; `subtaskStatus()` called twice per sub-task; spec internally inconsistent on done-derivation (§2 "reuse STATUS_BUCKET" vs §5 "subtaskStatus.ts" — impl followed §5, no live divergence for the closed label set).

**PENDING (deploy-time, not code):** live check that sub-tasks render with real Monday data in production requires a deploy + cron `/api/refresh` (`MONDAY_API_TOKEN` is cron-only, not local). Rendering + pipeline logic verified by 73/73 tests incl. a real RTL render asserting the dots, roll-up text, and aria-labels.

---

# PHASE 6 — Broker LOS module (new per-module board) — 2026-07-08

Branch: `feature/broker-los-board` · Spec: `docs/superpowers/specs/2026-07-08-broker-los-board-design.md` · Commits `954323c..ce8c307`

**Scope:** Added a new **Broker LOS** delivery module (broker-facing loan origination
system) reading its own Monday board `18420631446` (workspace LendLogic, 36 items).
Inserted after Lexi in the module order (10 modules total); **not** an analyzer.

**Key finding:** unlike every other per-module board (status in `task_status`), the
Broker LOS board keeps story status in the Monday-default **`status`** column. `api/refresh.ts`
hardcoded `task_status`, which would have read every item blank → 0%. Fixed by making
the status column **per-module**: new `MODULE_STATUS_COLUMN` `Record` + `getModuleStatusColumnId`
in `config.ts` (default `task_status`, `broker → status`), full record so a future board
must declare its own column. `refresh.ts` now passes `getModuleStatusColumnId(k)`.

**Verified against live board data:** 10 Done · 3 Working on it · 23 blank (mostly the
"Tech Stack & Dependencies" group, unstatused) → the production rollup yields
**Broker LOS 28% · Early build · "10 of 36 stories accepted"** (delivered 10 / inProgress 3
/ remaining 23), live (`assumed:false`). Labels all already in `STATUS_BUCKET`. Blank
tech-stack items count as remaining — faithful to the board; % rises as they're marked.

**Files:** `shared/readiness.ts` (broker module + baseline), `api/_lib/config.ts`
(ModuleKey, board maps, status-column map), `api/refresh.ts`. Tests updated across
`config`/`refresh`/`readiness`/`rollup`/`shared` specs. Suite **74/74**, `npm run build` clean.

**PENDING (deploy-time, not code):** live prod check that `MONDAY_API_TOKEN` reads board
`18420631446` via a `/api/refresh` 200 and Broker LOS appears in `/api/readiness`. Logic
verified by the suite + a throwaway rollup run against the real 36-item distribution.
Optional: set `ID_MONDAY_BROKER` in Vercel (code default already resolves).
