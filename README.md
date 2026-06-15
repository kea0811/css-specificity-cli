# css-specificity-cli

![tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)
![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)
![license](https://img.shields.io/badge/license-MIT-blue.svg)

**🌐 [Live demo →](https://css-specificity-cli.vercel.app)**

> Print a specificity heat map for any CSS file — the over-specific selectors light up red so you can see your refactor before you start it.

`css-specificity` reads a stylesheet, computes the `(ids, classes, types)` specificity of every selector, and prints a color-coded heat map: cool selectors stay quiet, hot ones (`#id` chains, deep `.class.class.class` stacks) glow red. Set a `--threshold` and it becomes a CI budget gate.

## Install

```bash
pnpm add -g css-specificity-cli
```

Requires Node 18+.

## License

MIT © [kea0811](https://github.com/kea0811)
