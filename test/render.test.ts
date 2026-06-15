import { createColors } from '../src/color.js';
import { heatLevel, renderReport } from '../src/render.js';
import type { Report, SelectorEntry, Specificity } from '../src/types.js';

const plain = createColors(false);

function entry(selector: string, specificity: Specificity, line = 1): SelectorEntry {
  return { selector, specificity, line };
}

function report(overrides: Partial<Report>): Report {
  const shown = overrides.shown ?? [];
  return {
    file: 'styles.css',
    total: overrides.total ?? shown.length,
    shown,
    max: overrides.max ?? [0, 0, 0],
    threshold: overrides.threshold ?? null,
    overBudget: overrides.overBudget ?? [],
    ...overrides,
  };
}

describe('heatLevel', () => {
  it('puts any ID in the hottest bucket', () => {
    expect(heatLevel([1, 0, 0])).toBe(4);
  });

  it('puts a stack of four classes in the hottest bucket', () => {
    expect(heatLevel([0, 4, 0])).toBe(4);
  });

  it('puts two or three classes in the warm bucket', () => {
    expect(heatLevel([0, 2, 0])).toBe(3);
  });

  it('puts a single class in the moderate bucket', () => {
    expect(heatLevel([0, 1, 0])).toBe(2);
  });

  it('puts a type-only selector in the cool bucket', () => {
    expect(heatLevel([0, 0, 1])).toBe(1);
  });

  it('puts a zero-specificity selector in the coolest bucket', () => {
    expect(heatLevel([0, 0, 0])).toBe(0);
  });
});

describe('renderReport (json)', () => {
  it('emits every field as JSON', () => {
    const out = renderReport(
      report({
        shown: [entry('#main', [1, 0, 0], 3)],
        total: 1,
        max: [1, 0, 0],
      }),
      { json: true, colors: plain },
    );
    const parsed = JSON.parse(out);
    expect(parsed.file).toBe('styles.css');
    expect(parsed.total).toBe(1);
    expect(parsed.max).toEqual([1, 0, 0]);
    expect(parsed.threshold).toBeNull();
    expect(parsed.overBudget).toEqual([]);
    expect(parsed.selectors).toEqual([{ selector: '#main', specificity: [1, 0, 0], line: 3 }]);
  });

  it('includes over-budget selectors when a threshold is set', () => {
    const over = entry('#main', [1, 0, 0], 2);
    const out = renderReport(
      report({ shown: [over], total: 1, max: [1, 0, 0], threshold: [0, 1, 0], overBudget: [over] }),
      { json: true, colors: plain },
    );
    const parsed = JSON.parse(out);
    expect(parsed.threshold).toEqual([0, 1, 0]);
    expect(parsed.overBudget).toHaveLength(1);
  });
});

describe('renderReport (heat map)', () => {
  it('reports when no selectors were found', () => {
    const out = renderReport(report({ total: 0 }), { json: false, colors: plain });
    expect(out).toBe('styles.css: no selectors found');
  });

  it('renders a single selector without a plural or summary', () => {
    const out = renderReport(
      report({ shown: [entry('a', [0, 0, 1])], total: 1, max: [0, 0, 1] }),
      { json: false, colors: plain },
    );
    expect(out).toContain('— 1 selector');
    expect(out).not.toContain('selectors');
    expect(out).toContain('max specificity');
    expect(out).not.toContain('budget');
  });

  it('paints every heat level and notes a truncated view', () => {
    const shown = [
      entry('#id', [1, 0, 0]),
      entry('.a.b.c.d', [0, 4, 0]),
      entry('.a.b', [0, 2, 0]),
      entry('.a', [0, 1, 0]),
      entry('div', [0, 0, 1]),
      entry('*', [0, 0, 0]),
    ];
    const out = renderReport(report({ shown, total: 9, max: [1, 0, 0] }), {
      json: false,
      colors: plain,
    });
    expect(out).toContain('(showing top 6)');
    expect(out).toContain('— 9 selectors');
    for (const glyph of ['█', '▓', '▒', '░', '·']) {
      expect(out).toContain(glyph);
    }
  });

  it('flags selectors over the budget', () => {
    const a = entry('#main', [1, 0, 0], 1);
    const b = entry('.nav', [0, 1, 0], 2);
    const out = renderReport(
      report({ shown: [a, b], total: 2, max: [1, 0, 0], threshold: [0, 1, 0], overBudget: [a] }),
      { json: false, colors: plain },
    );
    expect(out).toContain('✗ 1 selector over budget 0,1,0');
  });

  it('pluralizes the over-budget count', () => {
    const a = entry('#main', [1, 0, 0], 1);
    const b = entry('#side', [1, 0, 0], 2);
    const out = renderReport(
      report({
        shown: [a, b],
        total: 2,
        max: [1, 0, 0],
        threshold: [0, 1, 0],
        overBudget: [a, b],
      }),
      { json: false, colors: plain },
    );
    expect(out).toContain('✗ 2 selectors over budget 0,1,0');
  });

  it('confirms when everything is within budget', () => {
    const out = renderReport(
      report({
        shown: [entry('.a', [0, 1, 0])],
        total: 1,
        max: [0, 1, 0],
        threshold: [0, 5, 0],
        overBudget: [],
      }),
      { json: false, colors: plain },
    );
    expect(out).toContain('✓ all selectors within budget 0,5,0');
  });
});
