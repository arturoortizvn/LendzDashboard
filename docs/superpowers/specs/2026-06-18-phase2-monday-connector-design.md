# Design — Phase 2a: Live Monday connector (delivery modules)

**Date:** 2026-06-18
**Status:** approved (brainstorming) — pending spec review
**Scope of this doc:** Phase 2a only — wire the six delivery modules to live Monday data behind the unchanged `GET /api/readiness` contract. The Bank Analyzer composite (metrics DB) is Phase 2b; auth is Phase 3. Both are noted for context but out of scope here.

## 1. Context and goal

Phase 1 shipped the Readiness Console as a Vite + React SPA backed by a Vercel function at `GET /api/readiness` that returns a **static fixture** from `shared/readiness.ts` via `buildPayload(now)`. It is live in production (`lendz-dashboard.vercel.app`).

Phase 2a replaces the static numbers for the six **delivery** modules with values derived live from the Monday.com Stories board, **behind the same `GET /api/readiness` contract**. The frontend stays a dumb renderer; the data seam is the function. The Bank Analyzer (a `measurement` module fed by a metrics DB) stays on its fixture this round — it is Phase 2b, blocked on DB access/schema from Javi.

## 2. Scope

**Phase 2a (this spec):**
- Pull stories from the Monday Stories board (`18402839374`) and roll them up into the six delivery modules (pe, vt, uw, lexi, id, tax).
- Derive **live** per module: `counts`, `percent`, `status`/`statusLabel`, and `buckets` items (live story titles grouped by status).
- Keep editorial fields as static config: `name`, `sub`, `targetDate`, `dateConfidence`, `accentColor`.
- A module with no board coverage stays `assumed` (config baseline) — honest, badged, looks like v1.
- A scheduled rebuild (Vercel Cron) writes the assembled payload to Vercel Blob; `GET /api/readiness` reads the Blob (last-known-good).
- Vitest coverage on the connector, rollup, Blob layer, and the refactored endpoint. Existing suite stays green.

**Out of scope (later, noted for context):**
- **Phase 2b:** Bank Analyzer composite from the metrics DB (the `bank` measurement module). Blocked on DB read access + the six KPI table/column names.
- **Phase 3:** domain-restricted Google OAuth gating the page and the endpoint.

**Non-goals:** no writes to Monday, no webhooks/realtime, no per-user data, no redesign of the UI, no change to the discriminated-union contract shape.

## 3. Key discovery — the board has no reliable module dimension today

Verified live via the Monday MCP on 2026-06-18 against board `18402839374` (204 items, single group "All Tasks"):

- **Only 95/204 (47%) of stories are linked to an Epic** (`task_epic`). They are the formal acceptance-criteria stories created 2026-03-06 (`F-01-01`, `U-02-03`, `L-01-*`, …). The other ~109 items are loose bugs/tasks with **no epic and no name prefix** ("CLTV calculation issue", "rate sheets…", "adjustments…"), mostly active Pricing & Eligibility work.
- **There is no "Module" column.** Board columns are `task_status`, `task_priority`, `task_type` (Feature/Bug/…), `task_estimation`/`task_actual_effort` (SP), `link` (GitHub), `check` (Unplanned), `item_id` (display prefix "TLOS"), `task_epic`, `task_sprint`. None assigns an item to a console module.
- **The Epics taxonomy is module-aligned by prefix** (`F-01 · Price and Rules Foundation`→pe, `VT-01`→vt, `U-01`/`U-03`→uw, `U-02 · Core Analyzers`→bank+id, `L-01`/`L-02`→lexi) **but** many epics are not console tabs (Platform, RBAC, Loan Creation, Evidence Vault, Conditions, Actions, Journey, Contacts, Audit, QA), and **`tax` has no epic and no stories at all**.

**Consequence:** the PoC/fixture numbers (pe 53/75, uw 9/13, lexi 11/20) are **not reproducible from any board field** — the 53/75 came from counting the loose, untagged items that today cannot be attributed to a module by data. A naive live rollup keyed on epic/prefix would undercount badly (3–18 stories per module) and produce zero for tax. This is a board-governance gap, not a code problem, and matches the meeting note that Javi still needs to load/update tickets.

The mapping is therefore established by a **new dedicated board column** (§5), not by parsing prefixes or epics (both rejected as unreliable).

## 4. Decisions (brainstorming)

1. **Scope:** Monday connector only this round; Bank stays on its fixture (DB → 2b).
2. **What goes live:** numbers **and** bucket items — each bucket lists live Monday story titles grouped by status (not curated highlights).
3. **Mapping:** a new "Module" column on the board is the contract; build wiring-ready now; modules with no coverage stay `assumed` config.
4. **Failure mode:** serve last-known-good from a persistent store (not baseline) when a rebuild can't refresh.
5. **Store:** **Vercel Blob** (Vercel-native object storage, private). No third-party platform.
6. **Refresh architecture:** Vercel Cron rebuilds and writes the Blob; `GET /api/readiness` only reads the Blob.
7. **Freshness on plan:** upgrade to **Vercel Pro** for native ~15-min crons (Hobby crons are limited to ~once/day). Pro upgrade is an account/billing prerequisite to confirm with the account owner.
8. **Token:** a Monday API token is available / can be created by Arturo; set as a server-side secret in Vercel.

## 5. The board contract — a new "Module" column

- Add a single-select **`status`** column titled **"Module"** to the Stories board, with one label per console module:
  - `Pricing & Eligibility` → `pe`
  - `Verified Truth` → `vt`
  - `Underwriting` → `uw`
  - `Lexi` → `lexi`
  - `ID Analyzer` → `id`
  - `Tax Docs` → `tax`
  - (`Bank Analyzer` → `bank` is optional, for future story-side tracking; the connector ignores it this round since `bank` is a measurement module.)
- Items not belonging to any console module are left empty and excluded from all rollups.
- The connector maps each story to a module **only** via this column.
- The column is referenced by **ID through an env var** (`MONDAY_MODULE_COLUMN_ID`), so the connector is not hardcoded to a column that does not exist yet. This lets us build and unit-test the connector now (mocked board responses); turning data live requires only creating the column and setting its ID.
- **Ownership:** the team (Juan/Carlos/Javi) creates and populates the column. Until populated, every delivery module reads empty → stays `assumed`/baseline, so the dashboard renders exactly like v1. A handoff note ships with the exact label list (§13).

## 6. Status → bucket mapping (guide §3.2)

Encoded as a constant (`STATUS_BUCKET`), not inline:

| `task_status` | bucket |
|---|---|
| Done | delivered |
| In Progress, Code Review, QA | inProgress |
| Ready to start, Stuck, (blank) | remaining |

## 7. Rollup per delivery module (guide §3.3)

For each delivery module key:

1. Filter stories whose Module column equals that key.
2. Bucket each story by `task_status` per §6 → `counts { delivered, inProgress, remaining }`.
3. `percent = round(delivered / total * 100)` where `total = delivered + inProgress + remaining`. If `total === 0`, the module is treated as `assumed` (baseline) and skips computation.
4. `status` pill from thresholds (config): `on_track` if percent ≥ 65, `in_progress` if 40–64, `early` if < 40. `statusLabel` from an enum→label map (config can override per module).
5. **Bucket items (live):** each bucket lists the display titles of its stories. Titles are cleaned by stripping a leading sprint marker (`S\d+ · `) and an id prefix (`[A-Z]+-[\w-]+ · `). All items render (no cap this round); long columns are an accepted visual consequence of the "items live" decision and a cap is a trivial later addition.

Rollup is by **story count**, not story points (SP is mostly null on the board), matching the guide.

## 8. Computed vs editorial fields

Per delivery module:

- **Live (from board):** `counts`, `percent`, `status`, `statusLabel`, `buckets` items.
- **Static config (in `shared/`):** `key`, `name`, `sub`, `targetDate`, `dateConfidence`, `accentColor`.
- **`note`:** templated from counts for live modules (`"{delivered} of {total} stories accepted"`); the editorial config note is used for `assumed` modules.
- **`assumed` becomes derived:** a module is **live** when it has ≥ 1 tagged story; otherwise `assumed: true` with baseline values. vt/id/tax flip to live automatically once they get tagged stories. A config override can force `assumed` if needed.

## 9. Data contract changes (additive, frontend-compatible)

`ReadinessPayload` gains optional freshness fields:

```typescript
export interface ReadinessPayload {
  asOf: string;
  modules: Module[];
  source?: 'live' | 'baseline';   // baseline = served config fixture (Blob missing)
  builtAt?: string;               // when the live rebuild ran
}
```

`asOf` remains the display timestamp. The discriminated union (`Module` on `phase`) and every per-module shape are **unchanged**, so all existing components render as-is. The Masthead may optionally surface "baseline" when `source === 'baseline'` (small polish, not required).

## 10. Repo structure

```
api/
  readiness.ts        # GET — reads Blob → payload; Blob missing → config baseline
  refresh.ts          # CRON target (guarded by CRON_SECRET) — rebuild → write Blob
  _lib/               # server-only; the _ prefix keeps Vercel from routing these,
                      #   and the frontend never imports them (token safety)
    monday.ts         # Monday GraphQL client + cursor pagination (uses the token)
    rollup.ts         # STATUS_BUCKET, per-module rollup, title cleanup, assemble payload
    blob.ts           # read/write last-known-good behind a small interface (@vercel/blob)
    config.ts         # thresholds, status→label map, env reads (board id, column id)
shared/
  readiness.ts        # contract types + editorial config + baseline buildPayload (mostly unchanged)
vercel.json           # + crons: [{ "path": "/api/refresh", "schedule": "*/15 * * * *" }]
```

`api/_lib/*.test.ts` must stay excluded from deploy via `.vercelignore` (existing pattern: Vercel turns files under `api/` into functions). ESM relative imports inside `api/` carry explicit `.js` extensions (existing regression guard).

## 11. Data flow

**Cron (~15 min, Vercel Pro):** `GET /api/refresh` (guarded — rejects requests without the `CRON_SECRET` bearer / Vercel cron header) →
1. `monday.fetchBoardStories(token, boardId, moduleColumnId)` — paginate `items_page` (limit ~100; the 5M complexity cap was hit at 500) requesting columns `name`, `task_status`, and the Module column, looping `next_items_page(cursor)` until the cursor is null. ~3 pages for 204 items.
2. `rollup.buildDeliveryModules(stories, config)` — §7/§8.
3. Assemble `ReadinessPayload`: delivery modules live where covered else baseline; `bank` always from the fixture; `source: 'live'`, `builtAt: now`.
4. `blob.writeLatest(payload)` → `readiness/latest.json` (private Blob).

**Request:** `GET /api/readiness` → `blob.readLatest()` → return the payload with the existing `Cache-Control: s-maxage=900, stale-while-revalidate=1800`. If the Blob is missing/unreadable → `buildPayload(now)` config baseline with `source: 'baseline'`.

The Monday token lives only on the cron path; the request path never touches Monday.

## 12. Error handling, caching, security

- **Cron failure:** if the Monday fetch fails, **do not overwrite** the Blob (last-known-good is preserved); log and return a non-200 so the failed run is visible in Vercel. A missing token makes the cron fail loudly; the request keeps serving last-known-good.
- **Request:** Blob missing/unreadable → config baseline (never a 500 for this). A genuine unexpected error → 500, surfaced by the existing error card.
- **Caching/freshness:** the CDN cache header stays; the Blob is the durable last-known-good. Freshness is bounded by the cron interval (~15 min).
- **Security:** `MONDAY_API_TOKEN` is server-side only — never a `VITE_*` var, never bundled, used only in `api/_lib/monday.ts`. `CRON_SECRET` guards `/api/refresh`. `ID_MONDAY=18402839374` and `MONDAY_MODULE_COLUMN_ID` are env vars. The Blob store is private (server-side read). No secrets committed; pre-merge `git ls-files | grep -E '^\.env'` must be empty.

## 13. Testing strategy (TDD: red → green → refactor)

Vitest. The implementer writes and runs the tests.

- `rollup.test.ts`: status→bucket mapping; counts/percent; pill thresholds; title cleanup; `total === 0` → assumed/baseline; bucket-item grouping.
- `monday.test.ts`: cursor pagination loop; column-value parsing; error propagation — `fetch` mocked.
- `blob.test.ts`: write/read round-trip and missing-blob fallback — Blob SDK mocked.
- `readiness.test.ts` (update): returns the Blob payload; Blob-missing → baseline with `source: 'baseline'`.
- `refresh.test.ts`: rejects without `CRON_SECRET`; on a Monday failure it does not overwrite the Blob.
- A realistic board fixture captured from the live board (via MCP) drives the rollup tests.
- The existing 22-test suite and all frontend tests stay green (contract change is additive).

## 14. Deploy prerequisites and handoff

- **Vercel Pro upgrade** for native ~15-min crons — owner: Vercel account/billing (confirm with Juan).
- **Env vars** in Vercel (Preview + Production): `MONDAY_API_TOKEN`, `ID_MONDAY=18402839374`, `MONDAY_MODULE_COLUMN_ID`, `CRON_SECRET`; the Blob read/write token is injected when the Blob store is provisioned.
- **Provision the Vercel Blob store.**
- **Team / board hygiene (gates live numbers, not the code):** add the "Module" `status` column to board `18402839374` and tag items with the labels in §5. Until then every delivery module stays `assumed`/baseline and the dashboard renders like v1 — safe. A short handoff note to Juan/Carlos/Javi ships with the column spec and exact labels.

## 15. Open items and risks

- **Pro upgrade ownership** — billing decision on a work account; confirm before relying on a 15-min cron. (Fallback if Pro is declined: read-through-on-request rebuild or an external scheduler hitting `/api/refresh` — not designed here.)
- **`bank` story-side vs measurement** — `bank` is a measurement module fed by the DB (2b); its board work under `U-02` is not consumed by the console this round.
- **Long bucket columns** — the "items live" decision means a module with many stories shows a long list; a display cap / "+N more" is a known, easy follow-up.
- **Module column adoption** — coverage and the credibility of live numbers depend entirely on the team tagging stories; the connector is correct and self-updating regardless.
