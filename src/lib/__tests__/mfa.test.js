// Two-factor sign-in for the admin account (src/lib/mfa.js): the rules the
// Security section and the sign-in code step share, plus the wiring that
// keeps the feature out of the startup script and inside the app shell.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  authenticatorName,
  cleanCode,
  codeErrorMessage,
  groupSecret,
  qrImageSrc,
  shortDate,
  totpFactors,
  verifyCode,
} from '../mfa';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
// Found by name so the check survives the file being re-dated before merge.
const MIGRATION = `supabase/migrations/${readdirSync(new URL('../../../supabase/migrations/', import.meta.url)).find((f) => f.endsWith('_admin_mfa.sql'))}`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M0 0h1v1H0z"/></svg>';

describe('cleanCode', () => {
  it('keeps at most six digits', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('12-34-56-78')).toBe('123456');
    expect(cleanCode('abc')).toBe('');
    expect(cleanCode(null)).toBe('');
  });
});

describe('qrImageSrc', () => {
  const decoded = (src) => decodeURIComponent(src.slice(src.indexOf(',') + 1));

  it('turns the data: address Supabase sends into one a browser draws whole', () => {
    const src = qrImageSrc(`data:image/svg+xml;utf-8,${SVG}`);
    expect(src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    // A bare "#" would end the address early and cut the picture off.
    expect(src).not.toContain('#');
    expect(decoded(src)).toBe(SVG);
  });

  it('accepts bare SVG markup and an already encoded address', () => {
    expect(decoded(qrImageSrc(SVG))).toBe(SVG);
    expect(decoded(qrImageSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`))).toBe(SVG);
  });

  it('keeps a base64 address and refuses anything that is not an SVG', () => {
    const b64 = `data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`;
    expect(qrImageSrc(b64)).toBe(b64);
    expect(qrImageSrc('javascript:alert(1)')).toBe('');
    expect(qrImageSrc('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(qrImageSrc(undefined)).toBe('');
  });
});

describe('names, dates and secrets', () => {
  it('groups the secret key in fours', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSecret('JBS WY3')).toBe('JBSW Y3');
  });

  it('names each authenticator by the minute it was added', () => {
    expect(authenticatorName(new Date(2026, 9, 28, 2, 7))).toBe('Authenticator app, 28 Oct 2026 02:07');
    expect(shortDate('not a date')).toBe('');
  });

  it('splits authenticator apps from other factors by status', () => {
    const list = { all: [
      { id: 'a', factor_type: 'totp', status: 'verified' },
      { id: 'b', factor_type: 'totp', status: 'unverified' },
      { id: 'c', factor_type: 'phone', status: 'verified' },
    ] };
    const { verified, unverified } = totpFactors(list);
    expect(verified.map((f) => f.id)).toEqual(['a']);
    expect(unverified.map((f) => f.id)).toEqual(['b']);
    expect(totpFactors(null)).toEqual({ verified: [], unverified: [] });
  });
});

describe('verifyCode', () => {
  const client = (overrides = {}) => {
    const calls = [];
    return {
      calls,
      auth: { mfa: {
        challenge: async (a) => { calls.push(['challenge', a]); return overrides.challenge ?? { data: { id: 'ch' }, error: null }; },
        verify: async (a) => { calls.push(['verify', a]); return overrides.verify ?? { data: {}, error: null }; },
      } },
    };
  };

  it('challenges, then verifies the cleaned code', async () => {
    const c = client();
    expect(await verifyCode(c, 'f1', '123 456')).toEqual({ error: null });
    expect(c.calls).toEqual([['challenge', { factorId: 'f1' }], ['verify', { factorId: 'f1', challengeId: 'ch', code: '123456' }]]);
  });

  it('asks for six digits before calling Supabase', async () => {
    const c = client();
    expect((await verifyCode(c, 'f1', '123')).error).toMatch(/6-digit code/);
    expect(c.calls).toHaveLength(0);
  });

  it('turns Supabase errors into plain words and never throws', async () => {
    expect((await verifyCode(client({ verify: { data: null, error: { code: 'mfa_verification_failed' } } }), 'f1', '123456')).error)
      .toMatch(/That code did not work/);
    expect((await verifyCode(client({ challenge: { data: null, error: { status: 429 } } }), 'f1', '123456')).error)
      .toMatch(/Too many tries/);
    const throwing = { auth: { mfa: { challenge: async () => { throw new Error('offline'); } } } };
    expect((await verifyCode(throwing, 'f1', '123456')).error).toMatch(/Check your connection/);
    expect(codeErrorMessage({ code: 'mfa_challenge_expired' })).toMatch(/took too long/);
  });
});

describe('wiring', () => {
  it('the app shell asks for the code before any page (Layout wraps everything in MfaStepUpGate)', () => {
    const layout = read('src/Layout.jsx');
    expect(layout).toMatch(/import MfaStepUpGate from '@\/components\/auth\/MfaStepUpGate'/);
    expect(layout).toMatch(/<MfaStepUpGate>\s*<SidebarProvider>\s*<LayoutContent[^>]*>\{children\}<\/LayoutContent>\s*<\/SidebarProvider>\s*<\/MfaStepUpGate>/);
  });

  it('keeps the screens out of the startup script and away from members', () => {
    // The code screen and the Security card load only when needed.
    expect(read('src/components/auth/MfaStepUpGate.jsx')).toMatch(/lazy\(\(\) => import\('@\/components\/auth\/MfaCodePrompt'\)\)/);
    // The shell's gate does not load the setup helpers (they would add a
    // file to the list the startup script carries for the shell).
    expect(read('src/components/auth/MfaStepUpGate.jsx')).not.toMatch(/from '@\/lib\/mfa'/);
    const settings = read('src/pages/Settings.jsx');
    expect(settings).toMatch(/lazy\(\(\) => import\('@\/components\/settings\/SecurityCard'\)\)/);
    expect(settings).not.toMatch(/^import SecurityCard/m);
    // Nothing on the startup path imports the two-factor code.
    for (const file of ['src/App.jsx', 'src/main.jsx', 'src/lib/AuthContext.jsx', 'src/pages.config.js']) {
      expect(read(file)).not.toMatch(/mfa|MfaStepUp|SecurityCard/i);
    }
  });

  it('lets the QR code image load under the Content Security Policy (it is a data: SVG)', () => {
    const vercel = JSON.parse(read('vercel.json'));
    const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
    const imgSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('img-src')).split(/\s+/);
    expect(imgSrc).toContain('data:');
  });

  it('writes the copy without em or en dashes', () => {
    for (const file of ['src/lib/mfa.js', 'src/components/auth/MfaStepUpGate.jsx', 'src/components/auth/MfaCodePrompt.jsx', 'src/components/settings/SecurityCard.jsx']) {
      expect(read(file)).not.toMatch(/[\u2013\u2014]| -- /);
    }
    // In SQL "--" starts a comment, so only the dash characters are checked.
    expect(read(MIGRATION)).not.toMatch(/[\u2013\u2014]/);
  });
});
