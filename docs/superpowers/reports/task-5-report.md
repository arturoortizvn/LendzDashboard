# Task 5 Report: API client

## What was implemented

Created a typed readiness API client (`src/api.ts`) and comprehensive test suite (`src/api.test.ts`).

**Implementation:**
- `fetchReadiness(signal?: AbortSignal): Promise<ReadinessPayload>` — GETs `/api/readiness` with optional abort signal
- Type-safe payload using `ReadinessPayload` imported from `shared/readiness`
- Error handling: throws with message format `Failed to load readiness data (${status})` for non-ok responses
- JSON parsing cast to `ReadinessPayload`

**Tests (2 passing):**
1. Returns parsed payload on successful fetch (200 response)
2. Throws with status code in error message on non-ok response (500)

## TDD Evidence

### RED (Before implementation)
```bash
$ npm test -- src/api

Error: Failed to resolve import "./api" from "src/api.test.ts".
Does the file exist?
```
**Why expected:** Test file references `./api` which did not exist yet.

### GREEN (After implementation)
```bash
$ npm test -- src/api

✓ src/api.test.ts (2 tests) 2ms

Test Files  1 passed (1)
Tests  2 passed (2)
```

### Full suite verification
```bash
$ npx vitest run

✓ src/styles/styles.test.ts (1 test)
✓ src/api.test.ts (2 tests)
✓ api/readiness.test.ts (1 test)
✓ shared/readiness.test.ts (4 tests)
✓ src/App.test.tsx (1 test)

Test Files  5 passed (5)
Tests  9 passed (9)
```
All tests pass, no regressions.

## Files changed

- **Created:** `/src/api.ts` (10 lines) — the API client function
- **Created:** `/src/api.test.ts` (13 lines) — vitest suite with global fetch stubs

## Self-review findings

**Completeness:** ✓
- Matches brief specifications verbatim
- Error message format includes status code as required
- Signal parameter properly threaded through fetch options
- All test cases from brief implemented exactly

**Quality:**
- Type imports properly use `import type` (tree-shakeable)
- Error message is user-friendly and includes diagnostic info
- Test uses best practices: cleanup with `vi.unstubAllGlobals()` in afterEach
- No unnecessary code; YAGNI principle followed

**Test coverage:** ✓
- Happy path (ok response, parsed payload returned)
- Sad path (non-ok response, error with status code)
- Both async paths verified with proper async/await semantics

**Concerns:** None. Implementation is minimal, correct, and fully tested.

## Commit

```
3337ddc Add typed readiness API client
```

Branch: `feature/scaffold-readiness-console`
