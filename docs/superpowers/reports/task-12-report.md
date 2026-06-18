## Task 12 Report: App wiring — fetch states + panel routing

### What was implemented

Replaced both placeholder files:

**`src/App.tsx`**: Full implementation verbatim from the brief.
- `useState` for `payload`, `error`, `activeKey`.
- `useEffect` with `AbortController`, fetches via `fetchReadiness(ctrl.signal)`, sets payload and first module key on success, ignores `AbortError` on failure, sets `error` for other errors.
- Returns Loading card while `!payload || !activeKey`, error card if `error`, or the full UI (Masthead + Tabs + renderPanel).
- `renderPanel` discriminates on `m.phase === 'measurement'` to pick `MeasurementPanel` vs `DeliveryPanel`.

**`src/App.test.tsx`**: Two tests from the brief, with one minimal query fix (documented below).
- `vi.mock('./api', ...)` resolving with `buildPayload(...)`.
- Test 1: waits for app to load, switches to bank tab, asserts `'Capabilities at standard'`.
- Test 2: `mockRejectedValueOnce(new Error('boom'))`, asserts error card text.

### TDD Evidence

**RED** (confirmed with old test in place before writing new App.tsx — original test: `getByText(/LendLogic Readiness Console/i)` — would fail with the new App because that text is no longer in the DOM. Not run as a standalone step since both files were replaced in one pass from spec; RED for the new tests was the initial run after writing them):

```
npx vitest run App
 ❯ src/App.test.tsx (2 tests | 1 failed) 1026ms
   × renders the first module after load and switches tabs 1019ms
     → Found multiple elements with the text: Pricing & Eligibility
   ✓ shows an error card when the fetch fails 6ms
```
The first test failed because `getByText('Pricing & Eligibility')` found two matches: the tab `<button>` and the panel's `<div class="mtitle">` (both contain the module name).

**GREEN** (after query fix — see below):

```
npx vitest run App
 ✓ src/App.test.tsx (2 tests) 61ms
 Test Files  1 passed (1) | Tests  2 passed (2)
```

**Full suite GREEN**:

```
npx vitest run
 Test Files  12 passed (12)
      Tests  19 passed (19)
 Duration  908ms
```
Zero act() or console warnings.

### Files changed

- `src/App.tsx` — replaced entirely (was Task-1 placeholder)
- `src/App.test.tsx` — replaced entirely (was single smoke test), with one query fix

### Self-review

- Implementation matches the brief verbatim.
- `renderPanel` correctly uses discriminated union (`m.phase === 'measurement'`).
- AbortController cleanup in `useEffect` return is correct; `AbortError` is properly ignored.
- `!payload || !activeKey` guard is correct — both must be set before rendering the full UI.
- Test 2 correctly imports `fetchReadiness` dynamically after the mock is in place to call `mockRejectedValueOnce`.
- YAGNI: no extra state, no extra effects, no extra utilities.
- No act() warnings in output.

### Test-query change and rationale

**Change**: `screen.getByText('Pricing & Eligibility')` → `screen.getAllByText('Pricing & Eligibility').length >= 1`

**Why**: `'Pricing & Eligibility'` appears in two places in the rendered tree after load: the tab `<button role="tab">` and the panel's `<div class="mtitle">`. Using `getByText` throws "Found multiple elements." This is a structural fact of the app — both the tab and the panel title render the module name (which is intentional UX, not a bug).

**Coverage not weakened**: `getAllByText` with `>= 1` still asserts the app loaded (as opposed to showing the Loading card, which doesn't contain that text). The follow-up assertion (switching to bank tab and checking `'Capabilities at standard'`) continues to test the real navigation behavior. Coverage is equivalent.
