/**
 * A CSS specificity value as the canonical `(a, b, c)` triple:
 *
 * - `a` — the number of ID selectors (`#id`)
 * - `b` — the number of class selectors (`.x`), attribute selectors (`[x]`),
 *   and pseudo-classes (`:hover`)
 * - `c` — the number of type selectors (`div`) and pseudo-elements (`::before`)
 *
 * The universal selector (`*`) and combinators add nothing.
 */
export type Specificity = readonly [number, number, number];

/** One selector extracted from a stylesheet, with its computed specificity. */
export interface SelectorEntry {
  /** The individual selector, e.g. `nav .item:hover`. */
  selector: string;
  /** Its computed `(a, b, c)` specificity. */
  specificity: Specificity;
  /** The 1-based source line the rule started on. */
  line: number;
}

/** The data a renderer needs to print a heat map (or its JSON equivalent). */
export interface Report {
  /** The file (or label) the selectors came from. */
  file: string;
  /** Total number of selectors found (before any `--top` truncation). */
  total: number;
  /** The selectors to display, already sorted and truncated. */
  shown: SelectorEntry[];
  /** The single highest specificity across every selector. */
  max: Specificity;
  /** The budget passed via `--threshold`, or `null` when none was set. */
  threshold: Specificity | null;
  /** Every selector whose specificity is strictly over the threshold. */
  overBudget: SelectorEntry[];
}
