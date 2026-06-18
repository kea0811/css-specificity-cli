#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { run } from './cli.js';
import type { PathKind } from './deps.js';
import type { LoadedSource } from './sources.js';

/** Classify a path on disk, treating any stat failure as "missing". */
function statKind(path: string): PathKind {
  try {
    const stat = statSync(path);
    return stat.isDirectory() ? 'dir' : 'file';
  } catch {
    return 'missing';
  }
}

/** Recursively collect every `.css` file under `dir`, skipping `node_modules`/dotdirs. */
function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      if (dirent.name.startsWith('.') || dirent.name === 'node_modules') {
        continue;
      }
      const full = join(current, dirent.name);
      if (dirent.isDirectory()) {
        walk(full);
      } else if (dirent.name.toLowerCase().endsWith('.css')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/** Render a page in headless Chromium and return every stylesheet it applies. */
async function launchBrowser(url: string): Promise<LoadedSource[]> {
  // Optional dependency: only required when --browser is actually used.
  const playwright = await import('playwright').catch(() => {
    throw new Error('--browser needs the optional "playwright" dependency: run `npm i -D playwright && npx playwright install chromium`');
  });
  const { chromium } = playwright;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const sheets = await page.evaluate(() =>
      Array.from(document.styleSheets).map((sheet, index) => {
        try {
          const css = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
          return { label: sheet.href ?? `inline <style #${index + 1}>`, css };
        } catch {
          // Cross-origin sheet whose rules can't be read from script.
          return { label: sheet.href ?? `inline <style #${index + 1}>`, css: '' };
        }
      }),
    );
    return sheets.filter((sheet) => sheet.css !== '');
  } finally {
    await browser.close();
  }
}

run(process.argv.slice(2), {
  log: (message) => process.stdout.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
  readFile: (path) => (path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8')),
  fetchText: async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  },
  statKind,
  listCssFiles,
  launchBrowser,
  env: process.env,
}).then((code) => {
  if (code !== 0) {
    process.exitCode = code;
  }
});
