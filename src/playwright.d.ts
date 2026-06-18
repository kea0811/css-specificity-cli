/**
 * Minimal ambient surface for the optional `playwright` dependency, so the
 * `--browser` backend in bin.ts typechecks whether or not it's installed.
 */
declare module 'playwright' {
  interface CSSRuleLike {
    cssText: string;
  }
  interface StyleSheetLike {
    href: string | null;
    cssRules: ArrayLike<CSSRuleLike> & Iterable<CSSRuleLike>;
  }
  interface PageLike {
    goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
    evaluate<T>(fn: () => T): Promise<T>;
  }
  interface BrowserLike {
    newPage(): Promise<PageLike>;
    close(): Promise<void>;
  }
  export const chromium: {
    launch(): Promise<BrowserLike>;
  };

  // The page callback runs in a DOM context; expose just enough of it.
  const document: {
    styleSheets: ArrayLike<StyleSheetLike> & Iterable<StyleSheetLike>;
  };
}

declare const document: {
  styleSheets: ArrayLike<{
    href: string | null;
    cssRules: ArrayLike<{ cssText: string }> & Iterable<{ cssText: string }>;
  }> &
    Iterable<{
      href: string | null;
      cssRules: ArrayLike<{ cssText: string }> & Iterable<{ cssText: string }>;
    }>;
};
