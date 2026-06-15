/** A small set of ANSI color helpers. When disabled, every helper is the identity. */
export interface Colors {
  red(text: string): string;
  yellow(text: string): string;
  cyan(text: string): string;
  green(text: string): string;
  dim(text: string): string;
  bold(text: string): string;
}

function wrap(open: number, close: number): (text: string) => string {
  return (text) => `[${open}m${text}[${close}m`;
}

const identity = (text: string): string => text;

/**
 * Build a {@link Colors} palette. Pass `false` (no TTY, `NO_COLOR`, or
 * `--no-color`) to get a palette where every helper returns its input untouched.
 */
export function createColors(enabled: boolean): Colors {
  if (!enabled) {
    return {
      red: identity,
      yellow: identity,
      cyan: identity,
      green: identity,
      dim: identity,
      bold: identity,
    };
  }
  return {
    red: wrap(31, 39),
    yellow: wrap(33, 39),
    cyan: wrap(36, 39),
    green: wrap(32, 39),
    dim: wrap(2, 22),
    bold: wrap(1, 22),
  };
}
