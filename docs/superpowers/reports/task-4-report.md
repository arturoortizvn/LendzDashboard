# Task 4: Serverless function + Vercel config — Report

## Implementation Summary

Created three files as specified in the task brief:

1. **api/readiness.ts** — Vercel serverless handler that:
   - Imports `buildPayload` from `../shared/readiness`
   - Sets Cache-Control header with `s-maxage=900, stale-while-revalidate=1800`
   - Returns status 200 with JSON payload from `buildPayload(new Date().toISOString())`

2. **vercel.json** — Vercel deployment config with:
   - Rewrites rule to route all non-API requests to `/index.html` (SPA support)
   - Headers rule to add `X-Robots-Tag: noindex` to all responses

3. **api/readiness.test.ts** — Unit test using mock response object that verifies:
   - Handler returns HTTP 200
   - Response body contains `asOf` (string) and `modules` (array of length 7)
   - `Cache-Control` header contains `s-maxage`

## Test-Driven Development Evidence

### RED Stage (failing test)
```bash
npm test -- api/readiness
```

**Output before implementation:**
```
FAIL  api/readiness.test.ts [ api/readiness.test.ts ]
Error: Failed to resolve import "./readiness" from "api/readiness.test.ts". 
Does the file exist?
```
Expected failure: handler not yet created.

### GREEN Stage (passing test)
After creating `api/readiness.ts`:
```bash
npm test -- api/readiness
```

**Output after implementation:**
```
RUN  v3.2.6 /Users/arturoortiz/Proyectos/Viewnear/LendzDashboard

✓ api/readiness.test.ts (1 test) 1ms

Test Files  1 passed (1)
Tests  1 passed (1)
```

### Full Test Suite
```bash
npm test
```

**Output:**
```
RUN  v3.2.6 /Users/arturoortiz/Proyectos/Viewnear/LendzDashboard

✓ src/styles/styles.test.ts (1 test) 1ms
✓ api/readiness.test.ts (1 test) 1ms
✓ shared/readiness.test.ts (4 tests) 2ms
✓ src/App.test.tsx (1 test) 10ms

Test Files  4 passed (4)
Tests  7 passed (7)
```

All tests pass with no regressions.

## Files Changed

- **api/readiness.ts** — new serverless handler (7 lines)
- **api/readiness.test.ts** — new unit test (23 lines)
- **vercel.json** — new deployment config (6 lines)

## Self-Review Findings

✓ **Completeness**: All three files from the brief implemented verbatim.

✓ **Test Quality**: Mock response correctly implements `setHeader`, `status`, and `json` chainable methods. Test validates real behavior: statusCode, payload structure, header presence.

✓ **Code Correctness**:
  - Handler signature matches Vercel spec (VercelRequest, VercelResponse)
  - `buildPayload` import path relative to handler location: `../shared/readiness` (correct)
  - Cache-Control header value exact match: `s-maxage=900, stale-while-revalidate=1800`
  - No unused imports; minimal code

✓ **YAGNI**: No over-engineering; test mocks only what's necessary (no real Vercel runtime).

✓ **Naming**: Follows project conventions (handler as default export, test file colocated in api/).

✓ **No Regressions**: Full test suite passes (7 tests across 4 files).

## Concerns

None. All requirements met, tests passing, code matches brief exactly.

## Commit

```
8cb7782 Add /api/readiness serverless function and Vercel config
```

Branch: `feature/scaffold-readiness-console` (protected, no push needed per project flow)
