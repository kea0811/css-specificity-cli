import { Command, type CommanderError, InvalidArgumentError, Option } from 'commander';
import { type Colors, createColors } from './color.js';
import type { SourceDeps } from './deps.js';
import { parseSelectors } from './parser.js';
import { renderReport } from './render.js';
import { collectSources, type LoadedSource } from './sources.js';
import { compareSpecificity, parseSpecificity } from './specificity.js';
import type { Report, SelectorEntry, Specificity } from './types.js';

/** I/O hooks the CLI depends on. The binary wires these to the real process. */
export interface RunDeps extends SourceDeps {
  log: (message: string) => void;
  error: (message: string) => void;
  env: Record<string, string | undefined>;
}

interface CliOptions {
  json?: boolean;
  top?: number;
  sort: string;
  threshold?: string;
  color?: boolean;
  browser?: boolean;
}

const VERSION = '0.2.0';

const DESCRIPTION = 'Print a specificity heat map for any CSS file.';

const HELP_EXAMPLES = `
Examples:
  $ css-specificity styles.css
  $ css-specificity ./src                       # every .css file in a project
  $ css-specificity https://example.com         # all CSS a page links/embeds
  $ css-specificity https://example.com --browser   # plus runtime CSS-in-JS
  $ css-specificity styles.css --top 10
  $ css-specificity styles.css --threshold 0,3,0
  $ css-specificity styles.css --json
  $ cat styles.css | css-specificity -
`;

const trimTrailingNewline = (text: string): string => text.replace(/\n+$/, '');

/** Parse `--top`, rejecting anything that isn't a positive integer. */
function parseTop(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new InvalidArgumentError('must be a positive integer');
  }
  return n;
}

/** Sort newest-copy of `entries`; `spec` is most-specific-first, `source` keeps file order. */
function sortEntries(entries: SelectorEntry[], order: string): SelectorEntry[] {
  const copy = [...entries];
  if (order === 'source') {
    return copy;
  }
  copy.sort((x, y) => compareSpecificity(y.specificity, x.specificity));
  return copy;
}

/** The single highest specificity across `entries`. */
function maxSpecificity(entries: SelectorEntry[]): Specificity {
  return entries.reduce<Specificity>(
    (acc, entry) => (compareSpecificity(entry.specificity, acc) > 0 ? entry.specificity : acc),
    [0, 0, 0],
  );
}

/** Parse every source, tagging each selector with its origin when scanning many. */
function parseAllSources(sources: LoadedSource[]): SelectorEntry[] {
  const multi = sources.length > 1;
  const entries: SelectorEntry[] = [];
  for (const source of sources) {
    let parsed: SelectorEntry[];
    try {
      parsed = parseSelectors(source.css);
    } catch (err) {
      throw new Error(`could not parse ${source.label}: ${(err as Error).message}`);
    }
    for (const entry of parsed) {
      entries.push(multi ? { ...entry, source: source.label } : entry);
    }
  }
  return entries;
}

async function execute(input: string, options: CliOptions, deps: RunDeps, colors: Colors): Promise<number> {
  let sources: LoadedSource[];
  try {
    sources = await collectSources(input, { browser: options.browser === true }, deps);
  } catch (err) {
    deps.error(colors.red(`error: cannot read ${input}: ${(err as Error).message}`));
    return 2;
  }

  let entries: SelectorEntry[];
  try {
    entries = parseAllSources(sources);
  } catch (err) {
    deps.error(colors.red(`error: ${(err as Error).message}`));
    return 2;
  }

  let threshold: Specificity | null = null;
  if (options.threshold !== undefined) {
    const parsed = parseSpecificity(options.threshold);
    if (parsed === null) {
      deps.error(
        colors.red(`error: invalid --threshold "${options.threshold}" (expected "a,b,c", e.g. "0,3,0")`),
      );
      return 2;
    }
    threshold = parsed;
  }

  let overBudget: SelectorEntry[] = [];
  if (threshold !== null) {
    const budget = threshold;
    overBudget = entries.filter((entry) => compareSpecificity(entry.specificity, budget) > 0);
  }

  const sorted = sortEntries(entries, options.sort);
  const shown = options.top !== undefined ? sorted.slice(0, options.top) : sorted;

  const report: Report = {
    file: sources.length === 1 ? sources[0].label : input,
    total: entries.length,
    shown,
    max: maxSpecificity(entries),
    threshold,
    overBudget,
    sourceCount: sources.length,
  };

  deps.log(renderReport(report, { json: options.json === true, colors }));
  return overBudget.length > 0 ? 1 : 0;
}

/**
 * Parse `argv` (user args, without `node` and the script path) and run the CLI.
 * Returns the process exit code. Every side effect is injected via {@link RunDeps}.
 */
export async function run(argv: string[], deps: RunDeps): Promise<number> {
  let exitCode = 0;

  const program = new Command();
  program
    .name('css-specificity')
    .description(DESCRIPTION)
    .argument(
      '<input>',
      'a CSS file, a directory to scan, an http(s) URL, or "-" for stdin',
    )
    .option('-j, --json', 'print machine-readable JSON instead of a heat map')
    .option('--browser', 'for a URL, render in a headless browser to capture runtime CSS')
    .addOption(
      new Option('-t, --top <n>', 'show only the N most specific selectors').argParser(parseTop),
    )
    .addOption(
      new Option('-s, --sort <order>', 'order selectors by').choices(['spec', 'source']).default('spec'),
    )
    .option('--threshold <value>', 'budget gate: exit 1 if any selector exceeds it, e.g. "0,3,0"')
    .option('--no-color', 'disable ANSI colors (also respects the NO_COLOR env var)')
    .version(VERSION, '-v, --version', 'print the version number')
    .addHelpText('after', HELP_EXAMPLES)
    .exitOverride()
    .configureOutput({
      writeOut: (text) => deps.log(trimTrailingNewline(text)),
      writeErr: (text) => deps.error(trimTrailingNewline(text)),
    })
    .action(async (input: string, options: CliOptions) => {
      const colorsEnabled = options.color !== false && !deps.env.NO_COLOR;
      exitCode = await execute(input, options, deps, createColors(colorsEnabled));
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (err) {
    // exitOverride() turns help/version/parse failures into a thrown
    // CommanderError, which always carries a numeric exit code.
    return (err as CommanderError).exitCode;
  }
  return exitCode;
}
