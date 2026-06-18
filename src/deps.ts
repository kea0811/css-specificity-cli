import type { LoadedSource } from './sources.js';

/** What a path on disk turned out to be. */
export type PathKind = 'file' | 'dir' | 'missing';

/** The injectable I/O a source loader needs. The binary wires these to the real world. */
export interface SourceDeps {
  /** Read a file synchronously; `-` means stdin. */
  readFile: (path: string) => string;
  /** Fetch a URL and return its body as text. */
  fetchText: (url: string) => Promise<string>;
  /** Classify a path as a file, a directory, or missing. */
  statKind: (path: string) => PathKind;
  /** Recursively list every `.css` file under a directory. */
  listCssFiles: (dir: string) => string[];
  /**
   * Render a page in a headless browser and return every stylesheet it applies.
   * Optional: absent when the browser backend isn't installed.
   */
  launchBrowser?: (url: string) => Promise<LoadedSource[]>;
}
