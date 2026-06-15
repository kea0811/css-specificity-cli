import type { Specificity } from './types.js';

/** Single-colon notations that are really pseudo-elements (count toward `c`). */
const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);

/** Functional pseudo-classes whose own specificity is always zero. */
const ZERO_SPECIFICITY_PSEUDOS = new Set(['where']);

/** Functional pseudo-classes that take the specificity of their most specific argument. */
const SELECTOR_LIST_PSEUDOS = new Set(['is', 'not', 'has', 'matches', '-webkit-any', '-moz-any']);

const IDENT_PART = /[\w-]/;
const IDENT_START = /[a-zA-Z_]/;

/** Advance past an identifier starting at `start`, returning the index after it. */
function readIdent(source: string, start: number): number {
  let i = start;
  while (i < source.length && IDENT_PART.test(source[i])) {
    i += 1;
  }
  return i;
}

/** Given the index of `[`, return the index just past the matching `]`. */
function skipBrackets(source: string, start: number): number {
  const end = source.indexOf(']', start);
  return end === -1 ? source.length : end + 1;
}

/** Given the index of `(`, return the index of the matching `)` (or end of input). */
function matchParen(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') {
      depth += 1;
    } else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return source.length;
}

/** Split a selector list on top-level commas, ignoring commas nested in `()`/`[]`. */
export function splitSelectorList(source: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(' || ch === '[') {
      depth += 1;
    } else if (ch === ')' || ch === ']') {
      depth -= 1;
    }
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** The most specific argument in a selector list (per the `:is()`/`:not()` rule). */
function maxOfSelectorList(list: string): Specificity {
  let max: Specificity = [0, 0, 0];
  for (const part of splitSelectorList(list)) {
    const candidate = computeSpecificity(part);
    if (compareSpecificity(candidate, max) > 0) {
      max = candidate;
    }
  }
  return max;
}

/** Consume a pseudo-class/element starting at `:` and return its contribution. */
function consumePseudo(source: string, start: number): { next: number; spec: Specificity } {
  let nameStart = start + 1;
  let doubleColon = false;
  if (source[nameStart] === ':') {
    doubleColon = true;
    nameStart += 1;
  }
  const nameEnd = readIdent(source, nameStart);
  const name = source.slice(nameStart, nameEnd).toLowerCase();

  if (source[nameEnd] === '(') {
    const close = matchParen(source, nameEnd);
    const inner = source.slice(nameEnd + 1, close);
    const next = close + 1;
    if (ZERO_SPECIFICITY_PSEUDOS.has(name)) {
      return { next, spec: [0, 0, 0] };
    }
    if (SELECTOR_LIST_PSEUDOS.has(name)) {
      return { next, spec: maxOfSelectorList(inner) };
    }
    // Any other functional pseudo-class (`:nth-child`, `:lang`, …) counts as one.
    return { next, spec: [0, 1, 0] };
  }

  if (doubleColon || LEGACY_PSEUDO_ELEMENTS.has(name)) {
    return { next: nameEnd, spec: [0, 0, 1] };
  }
  return { next: nameEnd, spec: [0, 1, 0] };
}

/**
 * Compute the `(a, b, c)` specificity of a single complex selector.
 *
 * Handles ID, class, attribute, type, universal, pseudo-class, and
 * pseudo-element selectors, plus the functional forms `:is()`, `:not()`,
 * `:has()`, and `:where()`.
 */
export function computeSpecificity(selector: string): Specificity {
  let a = 0;
  let b = 0;
  let c = 0;
  let i = 0;

  while (i < selector.length) {
    const ch = selector[i];
    if (ch === '#') {
      i = readIdent(selector, i + 1);
      a += 1;
    } else if (ch === '.') {
      i = readIdent(selector, i + 1);
      b += 1;
    } else if (ch === '[') {
      i = skipBrackets(selector, i);
      b += 1;
    } else if (ch === ':') {
      const { next, spec } = consumePseudo(selector, i);
      a += spec[0];
      b += spec[1];
      c += spec[2];
      i = next;
    } else if (ch === '*') {
      i += 1;
    } else if (IDENT_START.test(ch)) {
      let end = readIdent(selector, i);
      if (selector[end] === '|') {
        // Namespaced type selector, e.g. `svg|rect`.
        end = readIdent(selector, end + 1);
      }
      c += 1;
      i = end;
    } else {
      // Combinators (` `, `>`, `+`, `~`) and anything else contribute nothing.
      i += 1;
    }
  }

  return [a, b, c];
}

/**
 * Compare two specificities. Returns a negative number when `x` is less
 * specific than `y`, a positive number when more specific, and `0` when equal.
 */
export function compareSpecificity(x: Specificity, y: Specificity): number {
  for (let k = 0; k < 3; k += 1) {
    if (x[k] !== y[k]) {
      return x[k] > y[k] ? 1 : -1;
    }
  }
  return 0;
}

/** Format a specificity as a compact `a,b,c` string. */
export function formatSpecificity(spec: Specificity): string {
  return `${spec[0]},${spec[1]},${spec[2]}`;
}

/**
 * Parse a specificity budget like `"0,3,0"`. Returns `null` when the value is
 * not three comma-separated non-negative integers.
 */
export function parseSpecificity(value: string): Specificity | null {
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length !== 3) {
    return null;
  }
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) {
    return null;
  }
  return [nums[0], nums[1], nums[2]];
}
