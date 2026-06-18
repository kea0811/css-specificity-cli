# css-specificity-cli

![tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)
![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

**🌐 [Live demo →](https://css-specificity-cli.vercel.app)**

> Print a specificity heat map for any CSS file — the over-specific selectors light up red so you can see the refactor before you start it.

You know that one stylesheet where every override needs an `!important` chaser? That's a specificity problem, and specificity is invisible until something breaks. `css-specificity` makes it visible: point it at a file and it prints every selector with its `(ids, classes, types)` score, sorted hottest-first and color-coded like a thermal camera. The `#id .deeply .nested` offenders glow red; the calm single-class selectors stay cool. Add a `--threshold` and it becomes a CI budget gate that fails the build when specificity creeps back up.

No config, no rules to tune, no stylesheet rewriting. Just the numbers you already implicitly fight with, made legible.

## For AI coding agents

Drop [`SKILL.md`](./SKILL.md) into your AI editor / Claude Code workspace and it learns how to use this tool — when to reach for it, the install + canonical command, the flags, and the gotchas that are easy to miss.

## Install

```bash
pnpm add -g css-specificity-cli
```

> Using npm or yarn? `npm install -g css-specificity-cli` / `yarn global add css-specificity-cli` work too. Or skip the install entirely with `pnpm dlx css-specificity-cli styles.css` (`npx` works the same way). Bleeding edge or before the first npm release: `pnpm add -g github:kea0811/css-specificity-cli`.

Requires Node 18+.

## Quick start

Point it at a stylesheet, a whole project, or a live URL:

```bash
css-specificity styles.css            # one file
css-specificity ./src                 # every .css file in a project
css-specificity https://example.com   # all CSS the page links or embeds
```

```text
styles.css — 8 selectors

  █  1,2,3  #app .sidebar ul li a:hover  L5
  █  1,2,1  nav#primary .menu-item.is-active  L6
  ▓  0,2,0  .card .title  L4
  ▓  0,2,0  [data-theme="dark"] .card  L7
  ▓  0,2,0  .btn:not(.btn--ghost)  L8
  ▒  0,1,0  :root  L1
  ▒  0,1,0  .card  L3
  ░  0,0,1  body  L2

  max specificity  1,2,3
```

Each row is one selector: a heat glyph (`█ ▓ ▒ ░ ·`, hot → cool), its `(a, b, c)` specificity, the selector itself, and the source line. Selectors are sorted most-specific-first by default, so the things most likely to bite you are at the top.

### Scan a whole project or a live page

Give it a **directory** and it walks the tree, scanning every `.css` file (skipping `node_modules` and dotfolders) into one report — each selector tagged with the file it came from:

```bash
css-specificity ./src
```

```text
./src — 2 selectors across 2 sources

  █  1,0,0  #x     src/a.css:L1
  ▓  0,2,0  .y .z  src/sub/b.css:L1
```

Give it an **`http(s)` URL** and it fetches the page, then pulls in every `<link rel="stylesheet">` and inline `<style>` block — each treated as its own source:

```bash
css-specificity https://example.com
```

That static fetch captures everything a server-rendered or static site ships. For apps that inject CSS at runtime (CSS-in-JS, styled-components, many React SPAs), add `--browser` to render the page in headless Chromium and read every stylesheet the live DOM actually applies:

```bash
css-specificity https://example.com --browser
```

`--browser` needs the optional [`playwright`](https://playwright.dev) dependency:

```bash
npm i -D playwright && npx playwright install chromium
```

> Reading from a directory or URL produces a **multi-source report**: selectors from every stylesheet are merged, sorted, and budget-checked together, with each row showing its origin. `--json` adds a `sources` count and a `source` field per selector.

### What the triple means

Specificity is a three-part score, compared left to right:

| Component | Counts | Examples |
| --- | --- | --- |
| **a** | ID selectors | `#header` |
| **b** | classes, attributes, pseudo-classes | `.btn`, `[type="text"]`, `:hover` |
| **c** | type selectors, pseudo-elements | `div`, `::before` |

`1,0,0` always beats `0,9,9` — a single ID outweighs any number of classes. `:where()` contributes nothing; `:is()`/`:not()`/`:has()` take the score of their most specific argument.

### Set a budget (great for CI)

```bash
css-specificity styles.css --threshold 0,2,0
```

```text
  …
  ✗ 2 selectors over budget 0,2,0
```

If any selector is more specific than the budget, `css-specificity` prints a red `✗` line and exits `1` — so it fails your pipeline instead of letting specificity quietly climb. When everything is within budget it exits `0` with a green `✓`.

### Show only the worst offenders

```bash
css-specificity styles.css --top 10
```

### Machine-readable output

```bash
css-specificity styles.css --json
```

```json
{
  "file": "styles.css",
  "total": 8,
  "max": [1, 2, 3],
  "threshold": null,
  "overBudget": [],
  "selectors": [
    { "selector": "#app .sidebar ul li a:hover", "specificity": [1, 2, 3], "line": 5 }
  ]
}
```

Pipe it into `jq`, store it as a build artifact, or diff two runs to watch specificity drift over time. You can also read from stdin with `-`:

```bash
cat styles.css | css-specificity -
```

## Options

| Flag | Description |
| --- | --- |
| `-j, --json` | Print machine-readable JSON instead of a heat map. |
| `-t, --top <n>` | Show only the N most specific selectors. |
| `-s, --sort <order>` | `spec` (most specific first, default) or `source` (file order). |
| `--threshold <a,b,c>` | Budget gate: exit `1` if any selector exceeds it, e.g. `0,3,0`. |
| `--browser` | For a URL, render the page in headless Chromium to capture runtime CSS (needs the optional `playwright` dependency). |
| `--no-color` | Disable ANSI colors (also respects the `NO_COLOR` env var). |
| `-v, --version` | Print the version. |
| `-h, --help` | Show usage and examples. |

## Programmatic API

The same building blocks ship as a typed ESM/CJS module, so you can compute specificity in your own scripts:

```ts
import { computeSpecificity, parseSelectors, compareSpecificity } from 'css-specificity-cli';

computeSpecificity('#nav .item:hover a'); // [1, 2, 1]

const entries = parseSelectors('.a {} #b div {}');
// [{ selector: '.a', specificity: [0,1,0], line: 1 }, … ]

compareSpecificity([1, 0, 0], [0, 9, 9]); // > 0  (one ID beats nine classes)
```

`run(argv, deps)` is exported too — the whole CLI with injectable `log`, `error`, `readFile`, and `env`, which is exactly how the test suite drives it.

## How it works

The selector tokenizer is hand-rolled: it walks each selector once, counting IDs into `a`, classes/attributes/pseudo-classes into `b`, and types/pseudo-elements into `c`. The interesting cases are the functional pseudo-classes — `:where()` is zeroed out, while `:is()`, `:not()`, and `:has()` recurse into their argument list and adopt the specificity of the most specific branch (compared as a real `(a, b, c)` tuple, not a flattened number, because `1,0,0` must always beat `0,9,9`).

Parsing the file itself is delegated to [PostCSS](https://postcss.org), so real-world CSS — nested `@media` blocks, comments, weird whitespace — is handled correctly, and `@keyframes` steps like `from`/`50%` are skipped because they aren't selectors. Every side effect (stdout, file reads, the environment) is injected, which is why the test suite reaches 100% coverage without touching your real terminal.

## Live demo

See it in action at **[css-specificity-cli.vercel.app](https://css-specificity-cli.vercel.app)** — a static page with a sample run.

## Contributing

PRs welcome — especially more selector edge cases and budget ergonomics. To hack on it:

```bash
pnpm install
pnpm test
pnpm build
```

`pnpm test:coverage` enforces 100% coverage, and `pnpm dev` rebuilds on change.

## License

MIT © [kea0811](https://github.com/kea0811)
