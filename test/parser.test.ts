import type { Rule } from 'postcss';
import { isInsideKeyframes, parseSelectors, ruleLine } from '../src/parser.js';

describe('ruleLine', () => {
  it('returns 0 when the rule has no source', () => {
    expect(ruleLine({} as Rule)).toBe(0);
  });

  it('returns 0 when the source has no start', () => {
    expect(ruleLine({ source: {} } as Rule)).toBe(0);
  });

  it('returns the 1-based start line when known', () => {
    expect(ruleLine({ source: { start: { line: 7 } } } as Rule)).toBe(7);
  });
});

describe('isInsideKeyframes', () => {
  it('is false when there is no parent', () => {
    expect(isInsideKeyframes({ parent: undefined } as Rule)).toBe(false);
  });

  it('is false when the parent is not an at-rule', () => {
    expect(isInsideKeyframes({ parent: { type: 'root' } } as unknown as Rule)).toBe(false);
  });

  it('is true inside @keyframes', () => {
    expect(
      isInsideKeyframes({ parent: { type: 'atrule', name: 'keyframes' } } as unknown as Rule),
    ).toBe(true);
  });

  it('is true inside a vendor-prefixed @keyframes', () => {
    expect(
      isInsideKeyframes({
        parent: { type: 'atrule', name: '-webkit-keyframes' },
      } as unknown as Rule),
    ).toBe(true);
  });

  it('is false inside other at-rules', () => {
    expect(
      isInsideKeyframes({ parent: { type: 'atrule', name: 'media' } } as unknown as Rule),
    ).toBe(false);
  });
});

describe('parseSelectors', () => {
  it('computes specificity and line for each rule', () => {
    const entries = parseSelectors('.a {\n  color: red;\n}\n#b div {\n  color: blue;\n}\n');
    expect(entries).toEqual([
      { selector: '.a', specificity: [0, 1, 0], line: 1 },
      { selector: '#b div', specificity: [1, 0, 1], line: 4 },
    ]);
  });

  it('splits selector lists into one entry each', () => {
    const entries = parseSelectors('h1, h2 { margin: 0 }');
    expect(entries.map((e) => e.selector)).toEqual(['h1', 'h2']);
  });

  it('skips empty selectors left by a trailing comma', () => {
    const entries = parseSelectors('.a, { color: red }');
    expect(entries.map((e) => e.selector)).toEqual(['.a']);
  });

  it('ignores keyframe steps', () => {
    const entries = parseSelectors('@keyframes spin { from { opacity: 0 } to { opacity: 1 } }');
    expect(entries).toEqual([]);
  });

  it('keeps selectors inside other at-rules', () => {
    const entries = parseSelectors('@media (min-width: 700px) { .wide { display: flex } }');
    expect(entries.map((e) => e.selector)).toEqual(['.wide']);
  });

  it('returns nothing for an empty stylesheet', () => {
    expect(parseSelectors('')).toEqual([]);
  });
});
