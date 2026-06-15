---
name: css-specificity-cli
description: Use when the user wants to audit, visualize, or gate CSS selector specificity — "which selectors are too specific", "specificity heat map", "fail CI when specificity is too high". A Node 18+ CLI that reads a CSS file and prints each selector's (a,b,c) specificity, sorted hottest-first, with a --threshold budget gate. Also exposes computeSpecificity/parseSelectors as a library.
---

# css-specificity-cli

Reads a CSS file and prints a color-coded heat map of every selector's `(ids, classes, types)` specificity, sorted most-specific-first. A `--threshold` flag turns it into a CI budget gate that exits non-zero when a selector is too specific. The specificity engine is also importable as a typed module.

## When to reach for this

User says:
- "which selectors in this stylesheet are too specific?"
- "show me a specificity heat map / specificity report for styles.css"
- "fail CI if any selector is more specific than one class / an ID"
- "I keep needing !important — find the specificity offenders"
- "compute the specificity of this selector" (use the library export)

User does NOT mean this when they ask for:
- ❌ A full CSS linter (formatting, unused rules, property errors) — point them at `stylelint`.
- ❌ Bundle/file size of CSS — different tool (e.g. `bundle-cost-cli`).
- ❌ Autofixing or rewriting selectors — this tool reports, it does not modify your CSS.

## Install

```bash
pnpm add -g css-specificity-cli   # global command
pnpm dlx css-specificity-cli styles.css   # or run without installing
```

Node 18+. One arg-parser + PostCSS as runtime deps.

## Most common pattern (95% of cases)

```bash
# heat map for a stylesheet, hottest selectors first
css-specificity styles.css

# fail CI when any selector is more specific than two classes
css-specificity styles.css --threshold 0,2,0

# only the 10 worst offenders
css-specificity styles.css --top 10

# JSON for tooling / diffing
css-specificity styles.css --json

# read from stdin
cat styles.css | css-specificity -
```

## Output (typical)

```
styles.css — 8 selectors

  █  1,2,3  #app .sidebar ul li a:hover  L5
  ▓  0,2,0  .card .title  L4
  ▒  0,1,0  .card  L3
  ░  0,0,1  body  L2

  max specificity  1,2,3
```

Glyphs run `█ ▓ ▒ ░ ·` from hot (any ID or 4+ classes) to cool (zero specificity). The triple is `(a=ids, b=classes/attrs/pseudo-classes, c=types/pseudo-elements)`.

## Flags

| Flag | What |
|---|---|
| `-j, --json` | machine-readable output instead of the heat map |
| `-t, --top <n>` | show only the N most specific selectors |
| `-s, --sort <order>` | `spec` (default, most specific first) or `source` (file order) |
| `--threshold <a,b,c>` | budget gate: exit `1` if any selector exceeds it, e.g. `0,3,0` |
| `--no-color` | disable ANSI colors (respects `NO_COLOR` too) |

Exit codes: `0` ok, `1` budget exceeded, `2` bad input (missing/unreadable file, unparseable CSS, malformed `--threshold`).

## CI recipe

```yaml
# .github/workflows/ci.yml step
- run: pnpm dlx css-specificity-cli src/styles.css --threshold 0,3,0
```

## Library API (same engine, no CLI)

```ts
import { computeSpecificity, parseSelectors, compareSpecificity } from 'css-specificity-cli';

computeSpecificity('#nav .item:hover a'); // [1, 2, 1]
compareSpecificity([1, 0, 0], [0, 9, 9]); // > 0  (one ID beats nine classes)
parseSelectors('.a {} #b div {}');         // [{ selector, specificity, line }, …]
```

## Gotchas

1. **Specificity is a tuple, not a sum.** `1,0,0` (one ID) beats `0,9,9` (nine classes + nine types). `--threshold 0,2,0` rejects anything strictly above two classes, including any single ID.
2. **`:where()` is zero; `:is()`/`:not()`/`:has()` inherit their most specific argument** — matching the CSS spec, so `:is(#a, .b)` scores `1,0,0`.
3. **`@keyframes` steps (`from`, `50%`) are skipped** — they aren't selectors. Selectors inside `@media`/`@supports` are included.
4. **It reports, it doesn't rewrite.** Use it to find offenders; fix them yourself.

## Links

- npm: https://www.npmjs.com/package/css-specificity-cli
- landing: https://css-specificity-cli.vercel.app
- repo: https://github.com/kea0811/css-specificity-cli
