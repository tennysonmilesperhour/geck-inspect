import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { dateFnsFiles, lucideIconFiles, readLucideBarrel, rewriteBarrelImports } from '../../../scripts/vite-plugins/direct-barrel-imports.mjs';
import { installReducedMotion } from '../reducedMotion';

const require = createRequire(path.resolve('package.json'));
const lucideBarrel = readLucideBarrel(require);
const maps = {
  lucide: lucideIconFiles(lucideBarrel.source, lucideBarrel.dir),
  dateFns: dateFnsFiles(JSON.parse(readFileSync(require.resolve('date-fns/package.json'), 'utf8'))),
};

describe('direct icon and date imports (build only)', () => {
  it('reads every icon and its aliases from lucide-react itself', () => {
    expect(maps.lucide.size).toBeGreaterThan(3000);
    expect(maps.lucide.get('X')).toBe('dist/esm/icons/x.mjs');
    // An alias resolves to the icon's real file.
    expect(maps.lucide.get('CheckCircle2')).toBe(maps.lucide.get('CircleCheck'));
    // Every mapped file exists, so the rewritten import resolves in the build.
    const pkgDir = path.dirname(require.resolve('lucide-react/package.json'));
    for (const file of new Set(maps.lucide.values())) expect(existsSync(path.join(pkgDir, file))).toBe(true);
    expect(maps.dateFns.has('parseISO')).toBe(true);
  });

  it('rewrites named imports to one file each and keeps local names', () => {
    const out = rewriteBarrelImports(
      "import { X, Loader2 as Spinner } from 'lucide-react';\nimport { format, parseISO as parse } from 'date-fns';\n",
      maps,
    );
    expect(out).toContain("import X from 'lucide-react/dist/esm/icons/x.mjs';");
    expect(out).toContain("import Spinner from 'lucide-react/dist/esm/icons/loader-circle.mjs';");
    expect(out).toContain("import { format } from 'date-fns/format';");
    expect(out).toContain("import { parseISO as parse } from 'date-fns/parseISO';");
    expect(out).not.toMatch(/from 'lucide-react';|from 'date-fns';/);
  });

  it('leaves names it cannot place on the original import, and other code alone', () => {
    const out = rewriteBarrelImports("import {\n  icons,\n  X,\n} from 'lucide-react'\nconst s = 'date-fns';", maps);
    expect(out).toContain("import X from 'lucide-react/dist/esm/icons/x.mjs';");
    expect(out).toContain("import { icons } from 'lucide-react';");
    expect(out).toContain("const s = 'date-fns';");
    expect(rewriteBarrelImports("import { icons } from 'lucide-react';", maps)).toBeNull();
    expect(rewriteBarrelImports("import React from 'react';", maps)).toBeNull();
  });
});

describe('reduced motion switch', () => {
  const media = (matches) => {
    const listeners = [];
    const query = { matches, addEventListener: (_e, fn) => listeners.push(fn) };
    vi.stubGlobal('window', { matchMedia: () => query });
    return { query, change: (next) => { query.matches = next; listeners.forEach((fn) => fn()); } };
  };

  it('does not load Framer Motion for people without the setting', async () => {
    media(false);
    const load = vi.fn();
    installReducedMotion(load);
    expect(load).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('turns animations off when the setting is on, and follows it when it changes', async () => {
    const { change } = media(true);
    const config = { skipAnimations: false };
    const load = vi.fn(() => Promise.resolve({ MotionGlobalConfig: config }));
    installReducedMotion(load);
    await Promise.resolve(); await Promise.resolve();
    expect(config.skipAnimations).toBe(true);
    change(false);
    await Promise.resolve(); await Promise.resolve();
    expect(config.skipAnimations).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
