# LendLogic Readiness Console — Implementation Guide

**Goal:** take the standalone HTML proof of concept and publish it as a live web app that pulls current data from Monday.com (story status) and the metrics database (Bank Statement Analyzer KPIs), refreshing on its own instead of carrying static numbers.

**Audience:** the LendLogic dev team.

**Scope:** this is a read-only reporting surface. No writes, no auth-gated actions, no mutation of source data. That keeps it simple. The whole thing is one small backend endpoint plus the existing UI refactored to fetch from it.

---

## 1. Architecture at a glance

```
                        ┌──────────────────────────┐
   Monday.com API ─────►│                          │
   (story status)       │   Readiness API          │
                        │   (thin backend service) │──────► Console UI
   Metrics DB ─────────►│                          │        (static host)
   (Bank Analyzer KPIs) │   - source connectors    │
                        │   - rollup + composite    │
                        │   - response cache        │
                        └──────────────────────────┘
```

Two source systems, one backend endpoint that owns the connections and the business logic, one frontend that does nothing but render what the endpoint returns.

**Why a backend, not direct-from-browser:** three concrete reasons, not preference.

1. **Token safety.** The Monday API token cannot ship to the browser. It lives as a server-side secret only.
2. **Logic in one place.** The module rollups (count stories by module, bucket by status) and the Bank Analyzer composite (the weighting schema, the near-target band, the cost-excluded denominator) are real business rules. They belong in one governed place on the server, not scattered across frontend code where they drift out of sync with the agreed definitions.
3. **Source protection.** A cached backend response means we hit the Monday API on a schedule, not once per page load per viewer. Stays well clear of rate limits and keeps the page fast.

---

## 2. The backend endpoint

One endpoint is enough: `GET /api/readiness`. It returns the full payload for all seven tabs. The frontend calls it once on load.

### 2.1 Response contract

Design the response so the frontend is a dumb renderer. Everything the UI shows is a field in here. Proposed shape:

```json
{
  "asOf": "2026-06-17T14:00:00Z",
  "modules": [
    {
      "key": "pe",
      "name": "Pricing and Eligibility Engine",
      "phase": "delivery",
      "percent": 71,
      "status": "on_track",
      "targetDate": "2026-07-11",
      "dateConfidence": "committed",
      "counts": { "delivered": 53, "inProgress": 14, "remaining": 8 },
      "assumed": false,
      "buckets": {
        "delivered": [ { "title": "Product catalog and field library", "detail": "..." } ],
        "inProgress": [ ... ],
        "remaining": [ ... ]
      }
    },
    {
      "key": "bank",
      "name": "Bank Statement Analyzer",
      "phase": "measurement",
      "percent": 77,
      "capabilitiesAtStandard": { "count": 4, "of": 6 },
      "targetDate": "2026-07-06",
      "dateConfidence": "projected",
      "metrics": [
        {
          "capability": "Reads statements correctly",
          "weight": 30, "current": "93.8%", "target": "95%", "status": "at_target"
        }
      ],
      "composite": { "value": 77, "denominator": 97, "costExcluded": true }
    }
  ]
}
```

Two `phase` values drive which template the frontend renders: `delivery` (the six story-tracked modules) and `measurement` (Bank Analyzer only). Keep that field; it is how the UI knows which layout to use.

### 2.2 What the endpoint does, in order

1. Fetch story data from Monday for the delivery modules.
2. Fetch KPI data from the metrics DB for the Bank Analyzer.
3. Run the rollup and composite logic.
4. Merge with the static config (module names, descriptions, target dates, assumed flags).
5. Cache the result.
6. Return JSON.

---

## 3. Source one — Monday.com (story status)

**Board:** Stories board, ID `18402839374`.
**Status column:** `task_status`, with values Done, QA, Code Review, In Progress, Ready to start, Stuck.
**Module identification:** the module is encoded in the item name prefix (`PR-`, `VT-`, `U-`, `L-`, etc.). See the Backlog ID Prefix Guide for the full mapping.

### 3.1 Pulling the data

Use the Monday GraphQL API (`https://api.monday.com/v2`). Pull all items on the board with name and status, paginating in pages of 200 via cursor. Pseudocode:

```
query {
  boards(ids: 18402839374) {
    items_page(limit: 200) {
      cursor
      items {
        name
        column_values(ids: ["task_status"]) { text }
      }
    }
  }
}
```

Then paginate with `next_items_page(cursor: "...")` until the cursor comes back empty.

### 3.2 Status to bucket mapping

This is the agreed mapping. Encode it as a constant, not inline:

| Monday status | Console bucket |
|---|---|
| Done | Delivered |
| In Progress, Code Review, QA | In Progress |
| Ready to start, Stuck, (no status) | Remaining |

### 3.3 Module rollup logic

For each delivery module:

1. Filter items whose name prefix maps to that module.
2. Count into the three buckets per the table above.
3. `percent = round(delivered / (delivered + inProgress + remaining) * 100)`.
4. `status` flag: `on_track` if percent ≥ 65, `in_progress` if 40–64, `early` if < 40. (Tune these thresholds with the team; they only drive the colored pill.)

**Important caveat for the team.** Three modules do not derive cleanly from the board today: Verified Truth, ID Analyzer, and Tax Docs Analyzer. Verified Truth is in an architecture/data-design phase and its lifecycle stories are not all tracked yet. ID and Tax have only scaffolding. For these three the PoC uses agreed, assumed figures (VT 55%, ID 30%, Tax 30%) flagged with an `assumed: true` badge in the UI. Until their stories are fully on the board, keep these as config-driven overrides rather than computed values. Do not silently compute a wrong number for them; the assumed flag is what keeps the dashboard honest.

---

## 4. Source two — metrics DB (Bank Statement Analyzer)

The Bank Analyzer tab is a measurement view, not a story rollup. Its six KPIs come from the metrics store we already stand up for the analyzer evaluation runs.

### 4.1 What to read

Per capability, the latest evaluation-window value:

| Capability | Source value | Target |
|---|---|---|
| Reads statements correctly | field-level extraction accuracy | 95% |
| Catches problems a human would | discrepancy recall / precision | 90% / 80% |
| Output the system trusts | VT proposal acceptance rate | 70% |
| Handles statement variety | coverage rate | 85% |
| Fast enough for the workflow | time-to-findings p95 | < 90s |
| Economical at scale | cost per statement | TBD |

Note that two of these are not live yet. "Output the system trusts" is blocked until the analyzer emits the VT proposal block and the accept/edit/reject signal is wired, so it returns a "not emitted" sentinel, not a number. "Economical at scale" has data but no target, so it returns its measured value with a null target. The UI already handles both states; the endpoint just needs to return them honestly rather than faking a value.

### 4.2 The composite score — the one piece of logic to get exactly right

This is the number Alessandra and PJ will scrutinize, so it must be reproducible and it must match the agreed weighting. Lock these as server-side constants:

```
WEIGHTS = {
  reads_correctly:   30,
  catches_problems:  25,
  output_trusted:    20,
  statement_variety: 15,
  fast_enough:        7,
  economical:         3
}
NEAR_TARGET_BAND = 0.05   // within 5% of target, trending up, counts as "near"
```

Composite algorithm:

1. Score each capability 0.0 to 1.0 against its target (capped at 1.0).
2. **Cost is held out of the denominator** until finance sets a target. So sum the weights of only the scored capabilities (currently 97, not 100).
3. `composite = sum(score × weight) / sum(weights in play) × 100`.
4. Round to whole number.

Worked example matching the current PoC (yields 77%):

```
reads_correctly   0.99 × 30 = 29.7
catches_problems  1.00 × 25 = 25.0
output_trusted    0.00 × 20 =  0.0   (blocked, not emitted)
statement_variety 0.92 × 15 = 13.8
fast_enough       0.90 ×  7 =  6.3
                              -----
                  total      = 74.8
denominator (cost excluded)  = 97
composite = 74.8 / 97 × 100  = 77%
```

Capability count (the "4 of 6" headline): count capabilities at target **or** near target (within the 5% band, trending up). Blocked and no-target capabilities do not count.

Keep the weighting schema and the near-target band in one config module with a comment pointing to the Readiness Data Mapping Guide as the source of record. If finance later sets a cost target, the only change is moving `economical` into the denominator; the algorithm does not change.

---

## 5. Caching and refresh

This data changes on the order of hours, not seconds, so do not hit the sources on every request.

- Cache the assembled `/api/readiness` response server-side with a TTL of 15 to 30 minutes.
- On cache miss, rebuild from both sources.
- Expose the `asOf` timestamp in the payload so the UI can show "as of HH:MM" and viewers know how fresh it is.
- Optional nicety: a manual refresh that busts the cache, for when someone wants the number immediately after a story moves.

If you want it closer to real time later, a scheduled job that rebuilds the cache every N minutes is simpler and safer than per-request fetching. Push (webhooks from Monday) is possible but is more than this needs right now.

---

## 6. Frontend refactor

The PoC HTML barely changes. The work is replacing the hardcoded numbers with a fetch.

1. On load, `fetch('/api/readiness')`.
2. Render the tab list and panels from the `modules` array. The existing markup becomes a template keyed off each module's `phase`.
3. `phase: "delivery"` renders the three-number band plus the three delivery buckets. `phase: "measurement"` renders the Bank Analyzer layout with the metrics table.
4. Keep all the styling, tooltips, the assumed badge, and the bar-fill animation exactly as they are. They are presentation; they do not care where the numbers come from.
5. Show the `asOf` timestamp in the masthead.
6. Handle the empty and sentinel states the endpoint can return: "not emitted", null target, assumed figures. The current UI already has visual treatments for these; just bind them to the data.

No framework is required. The PoC is vanilla HTML, CSS, and a little JS, and it can stay that way. If the team prefers to fold it into the existing React app as a route, the component maps cleanly onto the same response contract.

---

## 7. Hosting

It is a static frontend plus one backend endpoint, so almost anything works. In rough order of least effort:

- **Simplest:** serve the static HTML from the same service that hosts the API, single deploy, no CORS to think about.
- **Split:** static host (S3 plus CloudFront, Azure Static Web Apps, Netlify) for the page, the API as a small serverless function or a route on an existing service. Set CORS to allow the page origin.
- **Inside the platform:** if this should live behind the same access controls as the rest of LendLogic, add it as a route in the existing app rather than a separate host.

Given this shows internal delivery numbers, put it behind whatever access control the team already uses. A public unguessable URL is fine for a quick share but is not actually private. Decide with the team whether this needs to sit behind login.

---

## 8. Suggested build order

1. Stand up the `/api/readiness` endpoint returning the current static numbers as hardcoded JSON. Unblocks the frontend refactor immediately.
2. Wire the Monday connector and the rollup logic. Verify the delivery-module numbers match the PoC.
3. Wire the metrics DB connector and the composite logic. Verify the Bank Analyzer composite computes to 77 with current values.
4. Add caching and the `asOf` timestamp.
5. Refactor the frontend to fetch instead of hold static data.
6. Deploy, set access control, share the URL.

Steps 1, 5, and 6 are quick. The real work is steps 2 and 3, and most of step 3 is already specified above.

---

## 9. Things to confirm with the team before starting

- The Monday API token and which account it belongs to.
- Read access to the metrics DB and the exact table and column names for the six KPIs.
- The three assumed modules (VT, ID, Tax): confirm whether to keep them config-driven or whether their stories will be on the board soon enough to compute.
- Access control: login-gated or unguessable URL.
- Where it hosts: standalone or as a route inside the existing app.
