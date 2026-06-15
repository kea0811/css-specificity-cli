import { createColors } from '../src/color.js';

const E = '';

describe('createColors', () => {
  it('wraps text in ANSI codes when enabled', () => {
    const colors = createColors(true);
    expect(colors.red('x')).toBe(`${E}[31mx${E}[39m`);
    expect(colors.yellow('x')).toBe(`${E}[33mx${E}[39m`);
    expect(colors.cyan('x')).toBe(`${E}[36mx${E}[39m`);
    expect(colors.green('x')).toBe(`${E}[32mx${E}[39m`);
    expect(colors.dim('x')).toBe(`${E}[2mx${E}[22m`);
    expect(colors.bold('x')).toBe(`${E}[1mx${E}[22m`);
  });

  it('is the identity for every helper when disabled', () => {
    const colors = createColors(false);
    expect(colors.red('x')).toBe('x');
    expect(colors.yellow('x')).toBe('x');
    expect(colors.cyan('x')).toBe('x');
    expect(colors.green('x')).toBe('x');
    expect(colors.dim('x')).toBe('x');
    expect(colors.bold('x')).toBe('x');
  });
});
