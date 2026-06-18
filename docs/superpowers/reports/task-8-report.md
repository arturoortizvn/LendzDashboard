# Task 8: MetricsTable — Report

## Implementation Summary

Implemented `MetricsTable` component and test per brief specification.

### Files Created
- `src/components/MetricsTable.tsx` — Component rendering a metrics table with status mapping
- `src/components/MetricsTable.test.tsx` — Test verifying row rendering and sentinel values

### What Was Implemented

The `MetricsTable` component:
1. Accepts a `metrics: Metric[]` prop
2. Renders a table with five columns: Capability, Weight, Current, Target, Status
3. The "Current" column header includes an `InfoTooltip flipLeft` with the specified explanatory text
4. Maps each metric to a table row displaying all fields
5. The Weight field is formatted with a trailing `%` symbol
6. The Status field uses a `span` with class `st ${STATUS_CLASS[m.status]}` and displays the `statusLabel`
7. `STATUS_CLASS` is a `Record<Metric['status'], string>` mapping:
   - `at_target` → `ok`
   - `near` → `near`
   - `blocked` → `blk`
   - `no_target` → `none`

### TDD Evidence

#### RED (before component exists)
```bash
$ npx vitest run MetricsTable

 FAIL  src/components/MetricsTable.test.tsx [ src/components/MetricsTable.test.tsx ]
Error: Failed to resolve import "./MetricsTable" from "src/components/MetricsTable.test.tsx"
```
**Why expected:** Component file does not exist yet.

#### GREEN (after component implementation)
```bash
$ npx vitest run MetricsTable
 ✓ src/components/MetricsTable.test.tsx (1 test) 13ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

#### Full Suite Pass
```bash
$ npx vitest run
 ✓ src/styles/styles.test.ts (1 test) 2ms
 ✓ api/readiness.test.ts (1 test) 3ms
 ✓ src/api.test.ts (2 tests) 4ms
 ✓ shared/readiness.test.ts (4 tests) 3ms
 ✓ src/App.test.tsx (1 test) 15ms
 ✓ src/components/BucketColumn.test.tsx (1 test) 19ms
 ✓ src/components/MetricsTable.test.tsx (1 test) 15ms
 ✓ src/components/leaf.test.tsx (3 tests) 39ms

 Test Files  8 passed (8)
      Tests  14 passed (14)
```

### Code Quality Review

- Component is exactly as specified in the brief (verbatim match)
- `STATUS_CLASS` is a `Record` type to catch missing statuses at compile time (when new statuses are added to the `Metric` union)
- Imports use correct paths: `'../../shared/readiness'` and `'./InfoTooltip'`
- Test is minimal and focused: verifies row rendering and sentinel current values ("Not emitted")
- No extraneous code; YAGNI respected (no extra styling, exports, or features)
- Component is functional, type-safe, and testable

### No Concerns
- All tests pass
- Implementation matches brief verbatim
- No regressions in existing tests
