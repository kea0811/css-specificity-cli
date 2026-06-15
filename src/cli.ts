import { Command, type CommanderError, InvalidArgumentError, Option } from 'commander';
import { type Colors, createColors } from './color.js';
import { parseSelectors } from './parser.js';
import { renderReport } from './render.js';
import { compareSpecificity, parseSpecificity } from './specificity.js';
import type { Report, SelectorEntry, Specificity } from './types.js';

/** I/O hooks the CLI depends on. The binary wires these to the real process. */
export interface RunDeps {
  log: (message: string) => void;
  error: (message: string) => void;
  readFile: (path: string) => string;
  env: Record<string, string | undefined>;
}

interface CliOptions {
  json?: boolean;
  top?: number;
  sort: string;
  threshold?: string;
  color?: boolean;
}

const VERSION = '0.1.0';

const DESCRIPTION = 'Print a specificity heat map for any CSS file.';

const HELP_EXAMPLES = `
Examples:
  $ css-specificity styles.css
  $ css-specificity styles.css --top 10
  $ css-specificity styles.css --sort source
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

function execute(file: string, options: CliOptions, deps: RunDeps, colors: Colors): number {
  let css: string;
  try {
    css = deps.readFile(file);
  } catch (err) {
    deps.error(colors.red(`error: cannot read ${file}: ${(err as Error).message}`));
    return 2;
  }

  let entries: SelectorEntry[];
  try {
    entries = parseSelectors(css);
  } catch (err) {
    deps.error(colors.red(`error: could not parse ${file}: ${(err as Error).message}`));
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
    file,
    total: entries.length,
    shown,
    max: maxSpecificity(entries),
    threshold,
    overBudget,
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
    .argument('<file>', 'path to a CSS file (use "-" to read from stdin)')
    .option('-j, --json', 'print machine-readable JSON instead of a heat map')
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
    .action((file: string, options: CliOptions) => {
      const colorsEnabled = options.color !== false && !deps.env.NO_COLOR;
      exitCode = execute(file, options, deps, createColors(colorsEnabled));
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
