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

Final state: Tasks 1-12 complete + build fix + final-review test. 21/21 tests, build green, no secrets. Ready for push + PR (NO merge without user OK).
