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
 *
 * Any text outside tokens is kept as-is, so "{PREFIX}-{NNN}" → "JOH-001".
 */
function applyFormat(format, vars) {
  return format
    .replace(/\{PREFIX\}/g, vars.prefix || '???')
    .replace(/\{NNN\}/g, vars.nnn || '001')
    .replace(/\{SIRE\}/g, vars.sire || '??')
    .replace(/\{DAM\}/g, vars.dam || '??')
    .replace(/\{NUM\}/g, vars.num != null ? String(vars.num) : '1')
    .replace(/\{LETTER\}/g, vars.letter || 'a')
    .replace(/\{YYYY\}/g, vars.yyyy || String(new Date().getFullYear()))
    .replace(/\{YY\}/g, vars.yy || String(new Date().getFullYear()).slice(-2));
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
      return applyFormat(idSettings.hatchlingFormat, {
        prefix: getPrefix(user, idSettings.prefix),
        nnn: String(offspringNumber).padStart(3, '0'),
        sire: firstTwoTitleCase(sire.name),
        dam: firstTwoTitleCase(dam.name),
        num: offspringNumber,
        letter: eggLetter,
        yy: String(year).slice(-2),
        yyyy: String(year),
      });
    }
    return generateHatchedGeckoId(sire, dam, offspringNumber, year);
  }

  // ── Hatchling (free-text parent names) ───────────────────────────
  if (sireName || damName) {
    if (hasCustomFormat && idSettings.hatchlingFormat) {
      return applyFormat(idSettings.hatchlingFormat, {
        prefix: getPrefix(user, idSettings.prefix),
        nnn: '001',
        sire: firstTwoTitleCase(sireName),
        dam: firstTwoTitleCase(damName),
        num: 1,
        letter: 'a',
        yy: String(new Date().getFullYear()).slice(-2),
        yyyy: String(new Date().getFullYear()),
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
    });
  }

  return generateFounderGeckoId(user, allGeckos);
}
