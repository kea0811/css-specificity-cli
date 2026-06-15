import type { Colors } from './color.js';
import { compareSpecificity, formatSpecificity } from './specificity.js';
import type { Report, SelectorEntry, Specificity } from './types.js';

/** Options controlling how a {@link Report} is rendered. */
export interface RenderOptions {
  /** Emit machine-readable JSON instead of the heat map. */
  json: boolean;
  /** The palette to paint with. */
  colors: Colors;
}

/** A 5-step ramp from "cool" (low specificity) to "hot" (high). */
const HEAT_GLYPHS = ['·', '░', '▒', '▓', '█'] as const;

/**
 * Bucket a specificity into a heat level from 0 (cool) to 4 (hot). Any ID, or
 * a stack of several classes, lands in the hottest bucket.
 */
export function heatLevel(spec: Specificity): number {
  const [a, b, c] = spec;
  if (a > 0) {
    return 4;
  }
  if (b >= 4) {
    return 4;
  }
  if (b >= 2) {
    return 3;
  }
  if (b === 1) {
    return 2;
  }
  if (c > 0) {
    return 1;
  }
  return 0;
}

/** Paint `text` with the color that matches a heat `level`. */
function paintHeat(level: number, text: string, colors: Colors): string {
  switch (level) {
    case 4:
      return colors.red(text);
    case 3:
      return colors.yellow(text);
    case 2:
      return colors.cyan(text);
    case 1:
      return colors.green(text);
    default:
      return colors.dim(text);
  }
}

const toJsonEntry = (entry: SelectorEntry) => ({
  selector: entry.selector,
  specificity: entry.specificity,
  line: entry.line,
});

function renderJson(report: Report): string {
  return JSON.stringify(
    {
      file: report.file,
      total: report.total,
      max: report.max,
      threshold: report.threshold,
      overBudget: report.overBudget.map(toJsonEntry),
      selectors: report.shown.map(toJsonEntry),
    },
    null,
    2,
  );
}

function renderHeatmap(report: Report, colors: Colors): string {
  const { file, total, shown, threshold } = report;

  if (total === 0) {
    return colors.dim(`${file}: no selectors found`);
  }

  const lines: string[] = [];
  const shownNote = shown.length < total ? ` (showing top ${shown.length})` : '';
  const plural = total === 1 ? '' : 's';
  lines.push(`${colors.bold(file)} ${colors.dim(`— ${total} selector${plural}${shownNote}`)}`);
  lines.push('');

  const specWidth = Math.max(...shown.map((entry) => formatSpecificity(entry.specificity).length));
  for (const entry of shown) {
    const level = heatLevel(entry.specificity);
    const glyph = paintHeat(level, HEAT_GLYPHS[level], colors);
    const specText = paintHeat(level, formatSpecificity(entry.specificity).padStart(specWidth), colors);
    const over = threshold !== null && compareSpecificity(entry.specificity, threshold) > 0;
    const selectorText = over ? colors.red(entry.selector) : entry.selector;
    lines.push(`  ${glyph}  ${specText}  ${selectorText}  ${colors.dim(`L${entry.line}`)}`);
  }

  lines.push('');
  lines.push(`  ${colors.dim('max specificity')}  ${formatSpecificity(report.max)}`);

  if (threshold !== null) {
    const over = report.overBudget.length;
    if (over > 0) {
      const noun = over === 1 ? 'selector' : 'selectors';
      lines.push(`  ${colors.red(`✗ ${over} ${noun} over budget ${formatSpecificity(threshold)}`)}`);
    } else {
      lines.push(`  ${colors.green(`✓ all selectors within budget ${formatSpecificity(threshold)}`)}`);
    }
  }

  return lines.join('\n');
}

/** Render a report as either a colored heat map or a JSON document. */
export function renderReport(report: Report, options: RenderOptions): string {
  return options.json ? renderJson(report) : renderHeatmap(report, options.colors);
}
