import {
  compareSpecificity,
  computeSpecificity,
  formatSpecificity,
  parseSpecificity,
  splitSelectorList,
} from '../src/specificity.js';

describe('computeSpecificity', () => {
  it('counts ID selectors toward a', () => {
    expect(computeSpecificity('#header')).toEqual([1, 0, 0]);
  });

  it('counts class selectors toward b', () => {
    expect(computeSpecificity('.btn')).toEqual([0, 1, 0]);
  });

  it('counts attribute selectors toward b', () => {
    expect(computeSpecificity('[type="text"]')).toEqual([0, 1, 0]);
  });

  it('handles an unterminated attribute selector', () => {
    expect(computeSpecificity('[type')).toEqual([0, 1, 0]);
  });

  it('counts type selectors toward c', () => {
    expect(computeSpecificity('div')).toEqual([0, 0, 1]);
  });

  it('treats the universal selector as zero', () => {
    expect(computeSpecificity('*')).toEqual([0, 0, 0]);
  });

  it('counts a namespaced type selector once', () => {
    expect(computeSpecificity('svg|rect')).toEqual([0, 0, 1]);
  });

  it('counts double-colon pseudo-elements toward c', () => {
    expect(computeSpecificity('::before')).toEqual([0, 0, 1]);
  });

  it('counts legacy single-colon pseudo-elements toward c', () => {
    expect(computeSpecificity(':before')).toEqual([0, 0, 1]);
  });

  it('counts pseudo-classes toward b', () => {
    expect(computeSpecificity(':hover')).toEqual([0, 1, 0]);
  });

  it('treats :where() as zero specificity', () => {
    expect(computeSpecificity(':where(.a, #b)')).toEqual([0, 0, 0]);
  });

  it('takes the most specific argument of :is()', () => {
    expect(computeSpecificity(':is(.a, #b)')).toEqual([1, 0, 0]);
  });

  it('keeps the running max when a later :is() arg is less specific', () => {
    expect(computeSpecificity(':is(#b, .a)')).toEqual([1, 0, 0]);
  });

  it('takes the argument specificity of :not()', () => {
    expect(computeSpecificity(':not(.a)')).toEqual([0, 1, 0]);
  });

  it('handles nested functional pseudo-classes', () => {
    expect(computeSpecificity(':not(:is(a))')).toEqual([0, 0, 1]);
  });

  it('handles an unterminated functional pseudo-class', () => {
    expect(computeSpecificity(':not(a')).toEqual([0, 0, 1]);
  });

  it('treats other functional pseudo-classes as a single class', () => {
    expect(computeSpecificity(':nth-child(2)')).toEqual([0, 1, 0]);
  });

  it('sums a realistic complex selector', () => {
    // #nav (a) + .item + :hover (b) + a (c)
    expect(computeSpecificity('#nav > .item:hover a')).toEqual([1, 2, 1]);
  });

  it('ignores stray non-selector characters', () => {
    expect(computeSpecificity('0%')).toEqual([0, 0, 0]);
  });
});

describe('splitSelectorList', () => {
  it('splits on top-level commas', () => {
    expect(splitSelectorList('a, b')).toEqual(['a', ' b']);
  });

  it('ignores commas inside parentheses', () => {
    expect(splitSelectorList(':is(a, b), c')).toEqual([':is(a, b)', ' c']);
  });

  it('ignores commas inside brackets', () => {
    expect(splitSelectorList('[a,b], c')).toEqual(['[a,b]', ' c']);
  });

  it('returns a single item when there is no comma', () => {
    expect(splitSelectorList('a')).toEqual(['a']);
  });
});

describe('compareSpecificity', () => {
  it('returns a positive number when x is more specific', () => {
    expect(compareSpecificity([1, 0, 0], [0, 0, 0])).toBeGreaterThan(0);
  });

  it('returns a negative number when x is less specific', () => {
    expect(compareSpecificity([0, 0, 0], [1, 0, 0])).toBeLessThan(0);
  });

  it('returns zero when the two are equal', () => {
    expect(compareSpecificity([0, 1, 0], [0, 1, 0])).toBe(0);
  });

  it('compares later components when earlier ones tie', () => {
    expect(compareSpecificity([0, 1, 0], [0, 0, 5])).toBeGreaterThan(0);
  });
});

describe('formatSpecificity', () => {
  it('formats as a compact triple', () => {
    expect(formatSpecificity([1, 2, 3])).toBe('1,2,3');
  });
});

describe('parseSpecificity', () => {
  it('parses three integers', () => {
    expect(parseSpecificity('0,3,0')).toEqual([0, 3, 0]);
  });

  it('trims whitespace around the numbers', () => {
    expect(parseSpecificity('1, 2 ,3')).toEqual([1, 2, 3]);
  });

  it('rejects the wrong number of components', () => {
    expect(parseSpecificity('1,0')).toBeNull();
  });

  it('rejects non-numeric components', () => {
    expect(parseSpecificity('a,b,c')).toBeNull();
  });

  it('rejects negative components', () => {
    expect(parseSpecificity('1,-1,0')).toBeNull();
  });
});
