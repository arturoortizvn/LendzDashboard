# Editorial content on the delivery cards (status line, Go/No-Go + Go Live, expandable)

**Date:** 2026-07-08
**Status:** Approved (design)
**Branch:** `feature/card-editorial-content`

## Problem

The delivery card header (`.modband`) shows only `name`, the short `sub` descriptor,
and a single "Target / date". The team wants a richer, editorial (PM-authored) header
per workstream: a program status pill, a narrative status line, a two-date strip
(Go/No-Go + Go Live), and — for Underwriting only — an expandable detail block. This
content is manual/editorial and must be independent of the live Monday rollup.

Content is provided for **Pricing & Eligibility (pe)**, **Underwriting (uw)**, and
**Broker LOS (broker)**. The structure ships on every card; only these three carry
content for now, the rest degrade to the current header.

## Design

### 1. Data model — `shared/readiness.ts`

Add an optional, editorial `brief` object on `DeliveryModule` (untouched by the live
rollup — `buildDeliveryModule` only overrides percent/status/statusLabel/note/counts/
buckets, and spreads the rest):

```ts
export interface CardDetail {          // expandable, Underwriting-style
  phaseScope: string[]
  analyzerStatus: { name: string; note: string }[]
}
export interface CardBrief {
  programStatus: Status                // pill tone via STATUS_PILL (on_track → green)
  programStatusLabel: string           // exact editorial text, e.g. "On Track"
  statusLine: string                   // narrative, current-state
  goNoGo?: string                      // "Jul 20"
  goLive?: string                      // "Aug 1" / "Aug 1 (Phase 1)"
  detail?: CardDetail
}
// DeliveryModule gains:  brief?: CardBrief
```

Populate `brief` on pe/uw/broker verbatim from the content spec (uw includes `detail`
with 4 Phase-1-scope bullets + 4 analyzer-status lines).

### 2. Render — `src/components/DeliveryPanel.tsx` (header only; body unchanged)

- **Editorial pill** inside `.mtitle` when `brief`: `<span class="pill {STATUS_PILL[programStatus]}">{programStatusLabel}</span>`. The computed live pill in the "Delivery progress" card **stays** (both shown, per decision).
- **Short `sub` stays**; render `brief.statusLine` below it as `.statusline`.
- **Date strip** in `.release`: when `brief.goNoGo || brief.goLive`, render "Go / No-Go" + "Go Live" values (replaces the "Target / date" for that card); otherwise keep the current Target block.
- **Expandable**: when `brief.detail`, a native `<details class="detail cardetail">` block placed directly under `.modband` (full width), listing Phase 1 scope and Analyzer status. Native `<details>` = keyboard-accessible, no JS state.
- `.row3` (live % + computed pill + progress bar + note) and `.buckets` are **unchanged**.

### 3. Styles — `src/styles/app.css`

Reuse `.pill`/tones and the existing `.detail`/`summary` treatment. Add: `.mtitle .pill`
alignment fix (title context, not bignum), `.statusline`, `.modband .datestrip`
(two right-aligned date items), `.cardetail .detailbody` (two-column scope/analyzer
lists). `.modband` switches to `align-items: flex-start` to seat the taller content.
Visual polish via the frontend-design skill.

## Out of scope

- Content for the other cards (vt/lexi/bank/id/pl/paystub/tax) — they render the current
  header until briefs are supplied. The structure supports them with no further code.
- Any change to the live Monday rollup, buckets, or progress metrics.

## Testing

- `DeliveryPanel`: with a `brief` → renders the editorial pill label, the status line,
  the "Go / No-Go" + "Go Live" values, and (with `detail`) the expandable summary +
  scope/analyzer text; the computed live pill still renders. Without a `brief` → the
  "Target / date" block still renders (no regression).
- `rollup`: `buildDeliveryModule` preserves `brief` through a live rebuild (invariant).
- `shared/readiness`: pe/uw/broker each carry a `brief` (uw with `detail`).

## Branch & phasing

Single feature branch `feature/card-editorial-content`, TDD red→green:
1. Data model + content in `shared/readiness.ts`.
2. `DeliveryPanel` render (tests first).
3. CSS (frontend-design).
4. Verify (suite + build + drive the UI) + ledger.
