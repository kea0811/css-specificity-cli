import postcss, { list, type Rule } from 'postcss';
import { computeSpecificity } from './specificity.js';
import type { SelectorEntry } from './types.js';

/** The 1-based source line a rule started on (0 when the source is unknown). */
export function ruleLine(rule: Rule): number {
  return rule.source?.start?.line ?? 0;
}

/** True when a rule lives inside an `@keyframes` block (so `from`/`50%` aren't selectors). */
export function isInsideKeyframes(rule: Rule): boolean {
  const parent = rule.parent;
  if (!parent || parent.type !== 'atrule') {
    return false;
  }
  return /keyframes$/i.test((parent as { name: string }).name);
}

/**
 * Parse a stylesheet and return one {@link SelectorEntry} per individual
 * selector. Selector lists (`a, b`) are split, keyframe steps are ignored, and
 * every selector keeps the source line of the rule it came from.
 *
 * Throws `postcss.CssSyntaxError` on malformed CSS.
 */
export function parseSelectors(css: string): SelectorEntry[] {
  const root = postcss.parse(css);
  const entries: SelectorEntry[] = [];

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) {
      return;
    }
    const line = ruleLine(rule);
    for (const selector of list.comma(rule.selector)) {
      const trimmed = selector.trim();
      if (trimmed === '') {
        continue;
      }
      entries.push({ selector: trimmed, specificity: computeSpecificity(trimmed), line });
    }
  });

  return entries;
}
