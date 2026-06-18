# Task 6: Leaf components — Report

## Implementation Summary

Implemented three presentational leaf components and their test suite:

### Components Created
1. **AssumedBadge.tsx** — Simple span with `.assumed` class displaying text
2. **ProgressBar.tsx** — Animated progress bar with requestAnimationFrame effect and ARIA attributes
3. **InfoTooltip.tsx** — Tooltip wrapper with optional `flipLeft` for direction control
4. **leaf.test.tsx** — Comprehensive test suite for all three components

All components follow the brief's specifications verbatim. The global stylesheet (app.css) already contained all required CSS classes (`.assumed`, `.track`, `.fill`, `.info`, `.tip`, `.tip-left`).

## TDD Evidence

### RED State (Before Implementation)
```bash
npm test -- leaf
```
Result: No test files found, exiting with code 1
- Test file didn't exist; components not yet created

### GREEN State (After Implementation)
```bash
npm test -- leaf
```
```
 ✓ src/components/leaf.test.tsx (3 tests) 26ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

All three tests pass:
- `AssumedBadge renders its text` ✓
- `ProgressBar exposes the percent via aria` ✓
- `InfoTooltip renders its tip content` ✓

### Full Test Suite Verification
```bash
npm test
```
```
 ✓ src/styles/styles.test.ts (1 test) 1ms
 ✓ shared/readiness.test.ts (4 tests) 1ms
 ✓ api/readiness.test.ts (1 test) 1ms
 ✓ src/api.test.ts (2 tests) 3ms
 ✓ src/App.test.tsx (1 test) 10ms
 ✓ src/components/leaf.test.tsx (3 tests) 32ms

 Test Files  6 passed (6)
      Tests  12 passed (12)
```

All 12 tests pass across the entire suite; no failures or warnings.

## Files Changed

- **Created**: `src/components/AssumedBadge.tsx`
- **Created**: `src/components/ProgressBar.tsx`
- **Created**: `src/components/InfoTooltip.tsx`
- **Created**: `src/components/leaf.test.tsx`

## Self-Review Findings

✓ All code matches the brief verbatim, character-for-character
✓ ProgressBar uses requestAnimationFrame exactly as specified (not testing animated width, only static aria-valuenow)
✓ InfoTooltip correctly applies `tip-left` class when flipLeft prop is true
✓ AssumedBadge simple and correct
✓ Test assertions are focused on behavior, not implementation details
✓ No React act() warnings in test output
✓ No TypeScript errors
✓ No ESLint issues
✓ Full test suite passes with all prior tests still green
✓ Pristine test output, no warnings or noise

## Concerns

None. Implementation is complete, tests pass without warnings, and all components are properly integrated into the existing test suite.
