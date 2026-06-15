export {
  computeSpecificity,
  compareSpecificity,
  formatSpecificity,
  parseSpecificity,
  splitSelectorList,
} from './specificity.js';
export { parseSelectors, ruleLine, isInsideKeyframes } from './parser.js';
export { heatLevel, renderReport, type RenderOptions } from './render.js';
export { createColors, type Colors } from './color.js';
export { run, type RunDeps } from './cli.js';
export type { Specificity, SelectorEntry, Report } from './types.js';
