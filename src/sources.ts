import type { SourceDeps } from './deps.js';

/** A single stylesheet, ready to be parsed: a human label plus its raw CSS. */
export interface LoadedSource {
  /** Where the CSS came from — a path, URL, or `<style>` marker. */
  label: string;
  /** The raw CSS text. */
  css: string;
}

/** Options that influence how an input is resolved into stylesheets. */
export interface ResolveOptions {
  /** Drive a headless browser so runtime-injected CSS (CSS-in-JS, SPAs) is captured. */
  browser: boolean;
}

/** True when `input` looks like an `http(s)` URL we should fetch. */
export function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const LINK_TAG = /<link\b[^>]*>/gi;
const REL_ATTR = /\brel\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i;
const HREF_ATTR = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i;

/** Pull the value out of an `attr="x"` / `attr='x'` / `attr=x` match, or `null`. */
function attrValue(match: RegExpMatchArray | null): string | null {
  if (match === null) {
    return null;
  }
  // Exactly one of the three alternation groups matched.
  return match[2] ?? match[3] ?? match[4];
}

/** Resolve a possibly-relative stylesheet `href` against the page URL. */
export function resolveHref(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Extract every stylesheet referenced by an HTML document: the hrefs of
 * `<link rel="stylesheet">` tags (resolved against `base`) and the contents of
 * inline `<style>` blocks.
 */
export function extractStylesheets(
  html: string,
  base: string,
): { links: string[]; inline: string[] } {
  const links: string[] = [];
  for (const tag of html.match(LINK_TAG) ?? []) {
    const rel = attrValue(tag.match(REL_ATTR));
    if (rel === null || !/\bstylesheet\b/i.test(rel)) {
      continue;
    }
    const href = attrValue(tag.match(HREF_ATTR));
    if (href === null) {
      continue;
    }
    const resolved = resolveHref(href, base);
    if (resolved !== null) {
      links.push(resolved);
    }
  }

  const inline: string[] = [];
  let block: RegExpExecArray | null;
  STYLE_BLOCK.lastIndex = 0;
  while ((block = STYLE_BLOCK.exec(html)) !== null) {
    const css = block[1].trim();
    if (css !== '') {
      inline.push(css);
    }
  }

  return { links, inline };
}

/** Fetch a web page and gather all of its CSS via plain HTTP requests. */
async function loadFromUrlStatic(url: string, deps: SourceDeps): Promise<LoadedSource[]> {
  const html = await deps.fetchText(url);
  const { links, inline } = extractStylesheets(html, url);

  const sources: LoadedSource[] = [];
  inline.forEach((css, index) => {
    sources.push({ label: `${url} <style #${index + 1}>`, css });
  });
  for (const link of links) {
    sources.push({ label: link, css: await deps.fetchText(link) });
  }

  if (sources.length === 0) {
    throw new Error(`no stylesheets found at ${url}`);
  }
  return sources;
}

/** Load every stylesheet a web page applies, optionally via a headless browser. */
async function loadFromUrl(
  url: string,
  options: ResolveOptions,
  deps: SourceDeps,
): Promise<LoadedSource[]> {
  if (options.browser) {
    if (deps.launchBrowser === undefined) {
      throw new Error(
        'headless browser mode is unavailable — install the optional "playwright" dependency to use --browser',
      );
    }
    const sources = await deps.launchBrowser(url);
    if (sources.length === 0) {
      throw new Error(`no stylesheets found at ${url}`);
    }
    return sources;
  }
  return loadFromUrlStatic(url, deps);
}

/** Load every `.css` file under a directory as its own source. */
function loadFromDirectory(dir: string, deps: SourceDeps): LoadedSource[] {
  const files = deps.listCssFiles(dir);
  if (files.length === 0) {
    throw new Error(`no .css files found under ${dir}`);
  }
  return files.map((file) => ({ label: file, css: deps.readFile(file) }));
}

/**
 * Turn a CLI input into one or more {@link LoadedSource}s.
 *
 * - `-` reads CSS from stdin.
 * - An `http(s)` URL fetches the page and collects every linked and inline
 *   stylesheet (or, with `browser`, every stylesheet the rendered page applies).
 * - A directory is scanned recursively for `.css` files.
 * - Anything else is treated as a single CSS file.
 *
 * Throws an `Error` with a human-readable message when the input can't be read.
 */
export async function collectSources(
  input: string,
  options: ResolveOptions,
  deps: SourceDeps,
): Promise<LoadedSource[]> {
  if (input === '-') {
    return [{ label: '<stdin>', css: deps.readFile('-') }];
  }
  if (isUrl(input)) {
    return loadFromUrl(input, options, deps);
  }
  const kind = deps.statKind(input);
  if (kind === 'missing') {
    throw new Error(`no such file or directory: ${input}`);
  }
  if (kind === 'dir') {
    return loadFromDirectory(input, deps);
  }
  return [{ label: input, css: deps.readFile(input) }];
}
