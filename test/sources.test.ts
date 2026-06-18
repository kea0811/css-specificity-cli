import type { SourceDeps } from '../src/deps.js';
import {
  collectSources,
  extractStylesheets,
  isUrl,
  resolveHref,
  type LoadedSource,
} from '../src/sources.js';

const noDeps = (over: Partial<SourceDeps> = {}): SourceDeps => ({
  readFile: () => '',
  fetchText: async () => '',
  statKind: () => 'missing',
  listCssFiles: () => [],
  ...over,
});

describe('isUrl', () => {
  it('recognizes http and https', () => {
    expect(isUrl('http://a')).toBe(true);
    expect(isUrl('https://a')).toBe(true);
  });
  it('rejects paths', () => {
    expect(isUrl('styles.css')).toBe(false);
    expect(isUrl('./src')).toBe(false);
  });
});

describe('resolveHref', () => {
  it('resolves a relative href against the page URL', () => {
    expect(resolveHref('/a.css', 'https://x.test/page')).toBe('https://x.test/a.css');
  });
  it('returns null when the URL cannot be parsed', () => {
    expect(resolveHref('/a.css', 'not a url')).toBeNull();
  });
});

describe('extractStylesheets', () => {
  const base = 'https://x.test/';

  it('collects stylesheet links and inline styles', () => {
    const { links, inline } = extractStylesheets(
      '<link rel="stylesheet" href="/a.css"><style>.x {}</style>',
      base,
    );
    expect(links).toEqual(['https://x.test/a.css']);
    expect(inline).toEqual(['.x {}']);
  });

  it('ignores links without a rel, a non-stylesheet rel, or no href', () => {
    const { links } = extractStylesheets(
      '<link href="/a.css"><link rel="icon" href="/f.ico"><link rel="stylesheet">',
      base,
    );
    expect(links).toEqual([]);
  });

  it('skips links whose href cannot be resolved', () => {
    const { links } = extractStylesheets('<link rel="stylesheet" href="http://[bad">', base);
    expect(links).toEqual([]);
  });

  it('skips empty inline style blocks', () => {
    const { inline } = extractStylesheets('<style>   </style>', base);
    expect(inline).toEqual([]);
  });

  it('reads single-quoted and unquoted attributes', () => {
    const { links } = extractStylesheets("<link rel='stylesheet' href=/a.css>", base);
    expect(links).toEqual(['https://x.test/a.css']);
  });
});

describe('collectSources', () => {
  it('reads stdin for "-"', async () => {
    const sources = await collectSources('-', { browser: false }, noDeps({ readFile: () => '.a {}' }));
    expect(sources).toEqual<LoadedSource[]>([{ label: '<stdin>', css: '.a {}' }]);
  });

  it('reads a single file', async () => {
    const deps = noDeps({ statKind: () => 'file', readFile: () => '.a {}' });
    const sources = await collectSources('a.css', { browser: false }, deps);
    expect(sources).toEqual<LoadedSource[]>([{ label: 'a.css', css: '.a {}' }]);
  });

  it('throws for a missing path', async () => {
    await expect(collectSources('nope.css', { browser: false }, noDeps())).rejects.toThrow(
      'no such file or directory: nope.css',
    );
  });

  it('labels inline blocks and fetched links from a URL', async () => {
    const deps = noDeps({
      fetchText: async (url) =>
        url === 'https://x.test/' ? '<style>.a {}</style><link rel=stylesheet href=/b.css>' : '.b {}',
    });
    const sources = await collectSources('https://x.test/', { browser: false }, deps);
    expect(sources).toEqual<LoadedSource[]>([
      { label: 'https://x.test/ <style #1>', css: '.a {}' },
      { label: 'https://x.test/b.css', css: '.b {}' },
    ]);
  });
});
