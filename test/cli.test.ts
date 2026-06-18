import { run, type RunDeps } from '../src/cli.js';

const ESC = String.fromCharCode(27);

interface Harness {
  deps: RunDeps;
  out: string[];
  err: string[];
  stdout: () => string;
  stderr: () => string;
}

interface HarnessConfig {
  env?: Record<string, string | undefined>;
  urls?: Record<string, string>;
  dirs?: Record<string, string[]>;
  launchBrowser?: RunDeps['launchBrowser'];
}

function harness(files: Record<string, string>, config: HarnessConfig = {}): Harness {
  const { env = {}, urls = {}, dirs = {}, launchBrowser } = config;
  const out: string[] = [];
  const err: string[] = [];
  const deps: RunDeps = {
    log: (message) => out.push(message),
    error: (message) => err.push(message),
    readFile: (path) => {
      if (!(path in files)) {
        throw new Error(`ENOENT: no such file, open '${path}'`);
      }
      return files[path];
    },
    fetchText: async (url) => {
      if (!(url in urls)) {
        throw new Error(`HTTP 404 for ${url}`);
      }
      return urls[url];
    },
    statKind: (path) => (path in dirs ? 'dir' : path in files ? 'file' : 'missing'),
    listCssFiles: (dir) => dirs[dir] ?? [],
    launchBrowser,
    env,
  };
  return { deps, out, err, stdout: () => out.join('\n'), stderr: () => err.join('\n') };
}

const SAMPLE = '#main {}\n.nav {}\na {}\n';

describe('run', () => {
  it('prints a heat map and exits 0', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('#main');
    expect(h.stdout()).toContain('max specificity');
  });

  it('colors output by default', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    await run(['styles.css'], h.deps);
    expect(h.stdout()).toContain(ESC);
  });

  it('emits JSON with --json', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--json'], h.deps);
    expect(code).toBe(0);
    const parsed = JSON.parse(h.stdout());
    expect(parsed.total).toBe(3);
    expect(parsed.max).toEqual([1, 0, 0]);
  });

  it('limits output with --top', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--top', '1', '--json'], h.deps);
    expect(code).toBe(0);
    expect(JSON.parse(h.stdout()).selectors).toHaveLength(1);
  });

  it('rejects a non-positive --top', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--top', '0'], h.deps);
    expect(code).toBe(1);
    expect(h.stderr()).toContain('positive integer');
  });

  it('rejects a non-numeric --top', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--top', 'abc'], h.deps);
    expect(code).toBe(1);
  });

  it('keeps source order with --sort source', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--sort', 'source', '--json'], h.deps);
    expect(code).toBe(0);
    expect(JSON.parse(h.stdout()).selectors.map((s: { selector: string }) => s.selector)).toEqual([
      '#main',
      '.nav',
      'a',
    ]);
  });

  it('sorts most-specific-first by default', async () => {
    const h = harness({ 'styles.css': '.nav {}\n#main {}\na {}\n' });
    await run(['styles.css', '--json'], h.deps);
    expect(JSON.parse(h.stdout()).selectors.map((s: { selector: string }) => s.selector)).toEqual([
      '#main',
      '.nav',
      'a',
    ]);
  });

  it('rejects an unknown --sort value', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--sort', 'sideways'], h.deps);
    expect(code).toBe(1);
  });

  it('fails the budget gate when a selector is over --threshold', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--threshold', '0,1,0'], h.deps);
    expect(code).toBe(1);
    expect(h.stdout()).toContain('over budget');
  });

  it('passes the budget gate when everything is within --threshold', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--threshold', '9,9,9'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('within budget');
  });

  it('rejects an invalid --threshold value', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--threshold', 'nope'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('invalid --threshold');
  });

  it('exits 2 when the file cannot be read', async () => {
    const h = harness({});
    const code = await run(['missing.css'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('cannot read missing.css');
  });

  it('exits 2 when the CSS cannot be parsed', async () => {
    const h = harness({ 'broken.css': 'a {' });
    const code = await run(['broken.css'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('could not parse');
  });

  it('disables color with --no-color', async () => {
    const h = harness({ 'styles.css': SAMPLE });
    const code = await run(['styles.css', '--no-color'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).not.toContain(ESC);
  });

  it('disables color when NO_COLOR is set', async () => {
    const h = harness({ 'styles.css': SAMPLE }, { env: { NO_COLOR: '1' } });
    const code = await run(['styles.css'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).not.toContain(ESC);
  });

  it('prints help and exits 0', async () => {
    const h = harness({});
    const code = await run(['--help'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('Usage:');
    expect(h.stdout()).toContain('Examples:');
  });

  it('prints the version and exits 0', async () => {
    const h = harness({});
    const code = await run(['--version'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('0.2.0');
  });

  it('errors and exits non-zero when the file argument is missing', async () => {
    const h = harness({});
    const code = await run([], h.deps);
    expect(code).toBe(1);
    expect(h.stderr()).toContain('missing required argument');
  });

  it('scans every .css file in a directory and labels each selector', async () => {
    const h = harness(
      { 'src/a.css': '#main {}', 'src/b.css': '.nav {}' },
      { dirs: { src: ['src/a.css', 'src/b.css'] } },
    );
    const code = await run(['src', '--json'], h.deps);
    expect(code).toBe(0);
    const parsed = JSON.parse(h.stdout());
    expect(parsed.sources).toBe(2);
    expect(parsed.total).toBe(2);
    expect(parsed.selectors.map((s: { source: string }) => s.source).sort()).toEqual([
      'src/a.css',
      'src/b.css',
    ]);
  });

  it('shows the per-source locus in the heat map for a directory', async () => {
    const h = harness(
      { 'src/a.css': '#main {}', 'src/b.css': '.nav {}' },
      { dirs: { src: ['src/a.css', 'src/b.css'] } },
    );
    const code = await run(['src', '--no-color'], h.deps);
    expect(code).toBe(0);
    expect(h.stdout()).toContain('across 2 sources');
    expect(h.stdout()).toContain('src/a.css:L1');
  });

  it('exits 2 when a directory has no .css files', async () => {
    const h = harness({}, { dirs: { empty: [] } });
    const code = await run(['empty'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('no .css files found under empty');
  });

  it('fetches a URL and collects linked and inline stylesheets', async () => {
    const h = harness(
      {},
      {
        urls: {
          'https://x.test/': '<link rel="stylesheet" href="/a.css"><style>#hot {}</style>',
          'https://x.test/a.css': '.nav {}',
        },
      },
    );
    const code = await run(['https://x.test/', '--json'], h.deps);
    expect(code).toBe(0);
    const parsed = JSON.parse(h.stdout());
    expect(parsed.sources).toBe(2);
    expect(parsed.total).toBe(2);
  });

  it('exits 2 when a URL exposes no stylesheets', async () => {
    const h = harness({}, { urls: { 'https://x.test/': '<p>no css here</p>' } });
    const code = await run(['https://x.test/'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('no stylesheets found');
  });

  it('captures runtime CSS via --browser when a backend is available', async () => {
    const h = harness(
      {},
      {
        urls: { 'https://x.test/': '' },
        launchBrowser: async (url) => [{ label: `${url}#runtime`, css: '#app .btn {}' }],
      },
    );
    const code = await run(['https://x.test/', '--browser', '--json'], h.deps);
    expect(code).toBe(0);
    expect(JSON.parse(h.stdout()).max).toEqual([1, 1, 0]);
  });

  it('errors with --browser when no browser backend is wired', async () => {
    const h = harness({}, { urls: { 'https://x.test/': '' } });
    const code = await run(['https://x.test/', '--browser'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('headless browser mode is unavailable');
  });

  it('exits 2 when --browser finds no stylesheets', async () => {
    const h = harness({}, { launchBrowser: async () => [] });
    const code = await run(['https://x.test/', '--browser'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('no stylesheets found');
  });

  it('reports which stylesheet failed to parse when scanning many', async () => {
    const h = harness(
      { 'src/ok.css': '.a {}', 'src/bad.css': 'a {' },
      { dirs: { src: ['src/ok.css', 'src/bad.css'] } },
    );
    const code = await run(['src'], h.deps);
    expect(code).toBe(2);
    expect(h.stderr()).toContain('could not parse src/bad.css');
  });
});
