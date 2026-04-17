/**
 * GeckoForm helpers — pure functions, no React state.
 */

import { generateHatchedGeckoId, generateFounderGeckoId } from '@/components/shared/geckoIdUtils';

/**
 * Apply a user-defined format string by replacing known tokens.
 *
 * Tokens:
 *   {PREFIX}  — breeder prefix (first 3 chars of breeder_name or email)
 *   {NNN}     — zero-padded 3-digit sequential number
 *   {SIRE}    — first two letters of sire name (title-cased)
 *   {DAM}     — first two letters of dam name (title-cased)
 *   {NUM}     — offspring number this season
 *   {LETTER}  — clutch egg letter (a, b, c …)
 *   {YY}      — 2-digit year
 *   {YYYY}    — 4-digit year
 *   {LINE}    — prefix of the oldest founder ancestor (sire-side by default)
 *   {PARENT}  — full gecko_id_code of the direct parent (sire preferred)
 *   {SEX}     — m / f / u
 *   {CLUTCH}  — clutch number (same as NUM when clutch entity not present)
 *
 * Any text outside tokens is kept as-is, so "{PREFIX}-{NNN}" → "JOH-001".
 */
export function applyFormat(format, vars) {
  return format
    .replace(/\{PREFIX\}/g, vars.prefix || '???')
    .replace(/\{NNN\}/g, vars.nnn || '001')
    .replace(/\{SIRE\}/g, vars.sire || '??')
    .replace(/\{DAM\}/g, vars.dam || '??')
    .replace(/\{NUM\}/g, vars.num != null ? String(vars.num) : '1')
    .replace(/\{LETTER\}/g, vars.letter || 'a')
    .replace(/\{YYYY\}/g, vars.yyyy || String(new Date().getFullYear()))
    .replace(/\{YY\}/g, vars.yy || String(new Date().getFullYear()).slice(-2))
    .replace(/\{LINE\}/g, vars.line || vars.prefix || '???')
    .replace(/\{PARENT\}/g, vars.parent || '')
    .replace(/\{SEX\}/g, vars.sex || 'u')
    .replace(/\{CLUTCH\}/g, vars.clutch != null ? String(vars.clutch) : (vars.num != null ? String(vars.num) : '1'));
}

/**
 * Extract a short prefix from a gecko_id_code — the contiguous leading
 * alphabetic characters, max 4. Falls back to the first 3 alphanumeric
 * chars if no leading alpha run exists. Used by resolveLinePrefix.
 */
function leadingAlphaPrefix(code) {
  if (!code) return null;
  const m = /^[A-Za-z]{1,4}/.exec(code);
  if (m) return m[0];
  const fallback = code.replace(/[^A-Za-z0-9]/g, '').slice(0, 3);
  return fallback || null;
}

/**
 * Walk up the lineage on the chosen side until a founder (no sire_id and
 * no dam_id) is reached, then return the prefix embedded in that founder's
 * gecko_id_code. Side can be 'sire' (default) or 'dam'. Cycles and missing
 * records short-circuit and return null so callers can fall back.
 */
export function resolveLinePrefix(startGecko, allGeckos, side = 'sire', depthCap = 10) {
  if (!startGecko) return null;
  const byId = new Map((allGeckos || []).map((g) => [g.id, g]));
  let current = startGecko;
  const seen = new Set();
  for (let i = 0; i < depthCap; i++) {
    if (!current || seen.has(current.id)) return null;
    seen.add(current.id);
    const parentId = side === 'dam' ? current.dam_id : current.sire_id;
    if (!parentId) {
      return leadingAlphaPrefix(current.gecko_id_code);
    }
    const parent = byId.get(parentId);
    if (!parent) return leadingAlphaPrefix(current.gecko_id_code);
    current = parent;
  }
  return leadingAlphaPrefix(current?.gecko_id_code);
}

/**
 * Supported inheritance modes. Determines what {LINE} resolves to for
 * a hatchling given its sire + dam.
 *
 *   breeder_prefix  — always the breeder's own prefix (default)
 *   sire_line       — paternal lineage (walk up sire_id)
 *   dam_line        — maternal lineage (walk up dam_id)
 *   founder_origin  — sire-side if available, else dam-side, else breeder
 */
export const INHERITANCE_MODES = ['breeder_prefix', 'sire_line', 'dam_line', 'founder_origin'];

export function resolveLineForMode(user, sire, dam, allGeckos, mode, customPrefix) {
  const breederPrefix = getPrefix(user, customPrefix);
  switch (mode) {
    case 'sire_line':
      return resolveLinePrefix(sire, allGeckos, 'sire') || breederPrefix;
    case 'dam_line':
      return resolveLinePrefix(dam, allGeckos, 'dam') || breederPrefix;
    case 'founder_origin':
      return (
        resolveLinePrefix(sire, allGeckos, 'sire') ||
        resolveLinePrefix(dam, allGeckos, 'dam') ||
        breederPrefix
      );
    case 'breeder_prefix':
    default:
      return breederPrefix;
  }
}

function firstTwoTitleCase(name) {
  const clean = (name || '').replace(/[^A-Za-z0-9]/g, '');
  if (clean.length === 0) return '??';
  return clean.charAt(0).toUpperCase() + (clean.charAt(1) || '?').toLowerCase();
}

function getPrefix(user, customPrefix) {
  if (customPrefix) return customPrefix.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (user?.breeder_name || user?.email?.split('@')[0] || 'GECK')
    .substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Generate the next unique gecko_id_code for a user.
 *
 * Accepts an optional `idSettings` object from the collection settings
 * panel.  When present, the user's custom format string is applied
 * instead of the built-in pattern.
 *
 *   idSettings.founderFormat   — e.g. "{PREFIX}-{NNN}"
 *   idSettings.hatchlingFormat — e.g. "{SIRE}{DAM}{NUM}{LETTER}{YY}"
 *   idSettings.prefix          — custom prefix override (blank = auto)
 */
export async function generateNextGeckoId(user, allGeckos, sire = null, dam = null, sireName = '', damName = '', idSettings = null) {
  const hasCustomFormat = idSettings &&
    (idSettings.founderFormat !== '{PREFIX}{NUM}-{YY}' ||
     idSettings.hatchlingFormat !== '{SIRE}{DAM}{NUM}{LETTER}{YY}' ||
     idSettings.prefix);

  // ── Hatchling (linked sire + dam) ────────────────────────────────
  if (sire && dam) {
    const year = new Date().getFullYear();
    const siblingsThisSeason = (allGeckos || []).filter((g) => {
      if (g.sire_id !== sire.id || g.dam_id !== dam.id) return false;
      if (!g.hatch_date) return false;
      return new Date(g.hatch_date).getFullYear() === year;
    });
    const offspringNumber = siblingsThisSeason.length + 1;

    if (hasCustomFormat && idSettings.hatchlingFormat) {
      const eggLetter = ((offspringNumber - 1) % 2) === 0 ? 'a' : 'b';
      const sirePrefix = getPrefix(user, idSettings.prefix);
      const line = resolveLineForMode(
        user, sire, dam, allGeckos, idSettings.inheritanceMode, idSettings.prefix
      );
      return applyFormat(idSettings.hatchlingFormat, {
        prefix: sirePrefix,
        nnn: String(offspringNumber).padStart(3, '0'),
        sire: firstTwoTitleCase(sire.name),
        dam: firstTwoTitleCase(dam.name),
        num: offspringNumber,
        letter: eggLetter,
        yy: String(year).slice(-2),
        yyyy: String(year),
        line,
        parent: sire.gecko_id_code || dam.gecko_id_code || '',
        sex: 'u',
        clutch: offspringNumber,
      });
    }
    return generateHatchedGeckoId(sire, dam, offspringNumber, year);
  }

  // ── Hatchling (free-text parent names) ───────────────────────────
  if (sireName || damName) {
    if (hasCustomFormat && idSettings.hatchlingFormat) {
      const prefix = getPrefix(user, idSettings.prefix);
      return applyFormat(idSettings.hatchlingFormat, {
        prefix,
        nnn: '001',
        sire: firstTwoTitleCase(sireName),
        dam: firstTwoTitleCase(damName),
        num: 1,
        letter: 'a',
        yy: String(new Date().getFullYear()).slice(-2),
        yyyy: String(new Date().getFullYear()),
        line: prefix,
        parent: '',
        sex: 'u',
        clutch: 1,
      });
    }
    return generateHatchedGeckoId(
      { name: sireName || '' },
      { name: damName || '' },
      1
    );
  }

  // ── Founder (no parents) ─────────────────────────────────────────
  if (hasCustomFormat && idSettings.founderFormat) {
    const prefix = getPrefix(user, idSettings.prefix);
    const founderGeckos = (allGeckos || []).filter(
      g => !g.sire_id && !g.dam_id && g.gecko_id_code?.startsWith(prefix)
    );
    const seqNum = founderGeckos.length + 1;
    return applyFormat(idSettings.founderFormat, {
      prefix,
      nnn: String(seqNum).padStart(3, '0'),
      sire: '??',
      dam: '??',
      num: seqNum,
      letter: 'a',
      yy: String(new Date().getFullYear()).slice(-2),
      yyyy: String(new Date().getFullYear()),
      line: prefix,
      parent: '',
      sex: 'u',
      clutch: seqNum,
    });
  }

  return generateFounderGeckoId(user, allGeckos);
}
