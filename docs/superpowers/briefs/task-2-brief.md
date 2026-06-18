### Task 2: Port PoC styles

**Files:**
- Create: `src/styles/app.css`
- Modify: `src/main.tsx` (import the stylesheet)
- Test: `src/styles/styles.test.ts`

**Interfaces:**
- Produces: global stylesheet applying the PoC look via the original class names.

- [ ] **Step 1: Create `src/styles/app.css` by copying the PoC `<style>` block**

Copy the entire contents between `<style>` and `</style>` in `LendLogic_Readiness_Console.html` (lines 7–135) verbatim into `src/styles/app.css` (without the `<style>`/`</style>` tags). Append one rule for the assumed badge and weight chip if not already present:

```css
.assumed { display:inline-block; font-size:11px; font-weight:600; color:#8A5A00; background:#FFF3DD; padding:2px 8px; border-radius:999px; margin-left:8px; vertical-align:middle; }
.wt { display:inline-block; font-size:11px; font-weight:700; color:#3F5874; background:#EDF1F6; padding:1px 7px; border-radius:999px; margin-left:7px; }
```

- [ ] **Step 2: Import the stylesheet in `src/main.tsx`**

Add as the first import:

```tsx
import './styles/app.css'
```

- [ ] **Step 3: Write the failing test `src/styles/styles.test.ts`**

```ts
import { readFileSync } from 'node:fs'

test('app.css contains the core PoC classes', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')
  for (const cls of ['.masthead', '.tabs', '.panel', '.modband', '.bucket', '.bignum', '.fill']) {
    expect(css).toContain(cls)
  }
})
```

- [ ] **Step 4: Run the test**

Run: `npm test -- styles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Port PoC stylesheet into the React app"
```

---

