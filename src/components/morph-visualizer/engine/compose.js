/**
 * Phenotype resolver, turns raw user selections into a "phenotype" object
 * that the SVG renderer and explanation panels consume.
 *
 * Everything downstream (canvas + reasoning + rarity) reads THIS object,
 * never the raw selections. That means epistasis (one trait masking another)
 * is applied exactly once, in one place, which keeps the visualizer accurate.
 */

import {
  BASE_COLORS_BY_ID,
  MENDELIAN_MORPHS,
  PATTERN_TRAITS,
  ACCENT_TRAITS,
  TRAITS_BY_ID,
  ZYGOSITY as Z,
} from '../data/traits';
import { isVisuallyExpressed } from '../data/genetics';

const AXANTHIC_PALETTE = {
  base: '#cfcfcf',
  dark: '#2a2a2a',
  mid:  '#7a7a7a',
  light:'#efefef',
};

function desaturateHex(hex, amount = 0.3) {
  // amount 0 → no change, 1 → fully grey
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function lightenHex(hex, amount = 0.2) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function mixHex(a, b, amount = 0.5) {
  // amount 0 → a, 1 → b
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const ch = (i) => {
    const x = parseInt(pa.slice(i, i + 2), 16);
    const y = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * amount).toString(16).padStart(2, '0');
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

function darkenHex(hex, amount = 0.2) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/**
 * Compose selections → phenotype.
 *
 * Input shape (selections):
 *   {
 *     baseColor: 'red',
 *     mendelian: { lilly_white: 'visual', cappuccino: 'super', axanthic: 'het' },
 *     patterns:  { harlequin: 3, pinstripe: 4, dalmatian: 0 },       // 0–4 ladder
 *     accents:   { portholes: true, kneecaps: true },
 *     structural:{ crest_size: 'normal', tail: 'present', eye_color: 'gold' },
 *     environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
 *   }
 *
 * Returned phenotype:
 *   {
 *     palette: { base, highlight, shadow, dorsum, pattern, accent, eye },
 *     expressed: { lilly_white: true, cappuccino: true, axanthic: false, ... },
 *     patternIntensity: { harlequin: 3, pinstripe: 4, ... },   // 0–4, post-epistasis
 *     suppressed: { pattern: false, dorsal: true },
 *     fireFactor: 0.0 → 1.0,
 *     structural: { ... },
 *     reasoning: [ { trait, message } ],     // human-readable epistasis trace
 *     activeMorphs: [ { id, label, zygosity, category } ],
 *   }
 */
export function composePhenotype(selections) {
  const reasoning = [];

  const baseColorId = selections.baseColor || 'buckskin';
  const baseColor = BASE_COLORS_BY_ID[baseColorId] || BASE_COLORS_BY_ID.buckskin;

  // ---- 1. Build the raw palette from the polygenic base.
  let palette = {
    base:      baseColor.hex,
    highlight: lightenHex(baseColor.hex, 0.25),
    shadow:    darkenHex(baseColor.hex, 0.35),
    dorsum:    lightenHex(baseColor.hex, 0.15),
    pattern:   '#f1e7c8',  // cream, lateral / pinstripe / harlequin
    accent:    '#ffffff',
    eye:       '#d4a93b',
    belly:     lightenHex(baseColor.hex, 0.35),
  };

  // ---- 2. Environmental, fire state, age, shed.
  const env = selections.environmental || {};
  let fireFactor = 0.5;
  if (env.fire_state === 'fired_up')   fireFactor = 0.95;
  if (env.fire_state === 'fired_down') fireFactor = 0.15;

  if (fireFactor < 0.3) {
    // Washed-out, iridophore-dominant look.
    palette.base      = lightenHex(palette.base, 0.35);
    palette.highlight = lightenHex(palette.highlight, 0.15);
    palette.shadow    = lightenHex(palette.shadow, 0.2);
    palette.dorsum    = lightenHex(palette.dorsum, 0.25);
    palette.belly     = lightenHex(palette.belly, 0.2);
  } else if (fireFactor > 0.8) {
    palette.base    = darkenHex(palette.base, 0.05);
    palette.shadow  = darkenHex(palette.shadow, 0.1);
  }

  if (env.shed_state === 'pre_shed') {
    palette.base      = desaturateHex(palette.base, 0.5);
    palette.highlight = desaturateHex(palette.highlight, 0.5);
    palette.shadow    = desaturateHex(palette.shadow, 0.5);
    palette.dorsum    = lightenHex(palette.dorsum, 0.2);
    reasoning.push({ trait: 'shed_state', message: 'Pre-shed animal, base colors look dusty and desaturated.' });
  }

  if (env.age === 'juvenile') {
    // Juveniles are less saturated + pattern more obvious.
    palette.base      = desaturateHex(palette.base, 0.25);
    reasoning.push({ trait: 'age', message: 'Juvenile, saturation and pattern contrast develop with age.' });
  }

  // ---- 3. Resolve which Mendelian morphs are visually expressed.
  const mend = selections.mendelian || {};
  const expressed = {};
  const activeMorphs = [];
  MENDELIAN_MORPHS.forEach((m) => {
    const zyg = mend[m.id] || Z.ABSENT;
    const vis = isVisuallyExpressed(m.id, zyg);
    expressed[m.id] = vis;
    if (zyg !== Z.ABSENT) {
      activeMorphs.push({ id: m.id, label: m.name, zygosity: zyg, category: 'mendelian' });
    }
  });

  // ---- 4. Epistasis pass, apply in fixed order so the result is deterministic.
  const suppressed = { pattern: false, dorsal: false, lateral: false, warmPigment: false };

  // Axanthic masks warm pigment entirely.
  if (expressed.axanthic) {
    palette.base      = AXANTHIC_PALETTE.base;
    palette.highlight = AXANTHIC_PALETTE.light;
    palette.shadow    = AXANTHIC_PALETTE.dark;
    palette.dorsum    = AXANTHIC_PALETTE.light;
    palette.belly     = AXANTHIC_PALETTE.light;
    palette.pattern   = AXANTHIC_PALETTE.light;
    suppressed.warmPigment = true;
    reasoning.push({
      trait: 'axanthic',
      message: 'Axanthic removes xanthophores, base color is replaced by a grayscale palette.',
    });
  }

  // Cappuccino visual, dark body, cream dorsum.
  if (expressed.cappuccino) {
    const capp = TRAITS_BY_ID.cappuccino.visual;
    palette.base    = mend.cappuccino === Z.SUPER ? darkenHex(capp.bodyDarkHex, 0.05) : capp.bodyDarkHex;
    palette.shadow  = darkenHex(palette.base, 0.25);
    palette.dorsum  = capp.dorsumCreamHex;
    palette.highlight = lightenHex(palette.dorsum, 0.1);
    suppressed.dorsal = true;
    reasoning.push({
      trait: 'cappuccino',
      message: mend.cappuccino === Z.SUPER
        ? 'Super Cappuccino (Melanistic), dorsum fully patternless, body saturated dark coffee.'
        : 'Cappuccino, connected cream dorsum, coffee-brown body.',
    });
  }

  // Sable, saturated chocolate body that stays dark when fired down, and a
  // quieter pattern. It sits on the same gene as Cappuccino, so one copy of
  // each is a Luwak: Cappuccino keeps its dorsum, Sable darkens the body.
  const sableSuper = mend.sable === Z.SUPER;
  if (expressed.sable) {
    const sable = TRAITS_BY_ID.sable.visual;
    const sableBody = sableSuper ? sable.superBodyHex : sable.bodyHex;
    palette.base    = expressed.cappuccino ? mixHex(palette.base, sableBody, 0.6) : sableBody;
    palette.shadow  = darkenHex(palette.base, 0.3);
    if (!expressed.cappuccino) {
      palette.dorsum    = lightenHex(palette.base, 0.12);
      palette.highlight = lightenHex(palette.base, 0.2);
    }
    palette.belly   = mixHex(palette.belly, palette.base, 0.4);
    palette.pattern = mixHex(palette.pattern, palette.base, sableSuper ? 0.55 : 0.35);
    // Sable stays dark fired down, so the pale fired-down wash is lighter.
    fireFactor = Math.max(fireFactor, sableSuper ? 0.6 : 0.5);
    reasoning.push({
      trait: 'sable',
      message: expressed.cappuccino
        ? 'Luwak (Cappuccino + Sable), Cappuccino dorsum over a darker Sable body. Never a super.'
        : sableSuper
          ? 'Super Sable, very dark chocolate body and strongly muted pattern, dark even when fired down.'
          : 'Sable, saturated chocolate body that stays dark when fired down, with a quieter pattern.',
    });
  }

  // Highway, continuous clean dorsal stripe over clean sides. Cappuccino's
  // dorsum takes priority when both are present.
  const highwaySuper = mend.highway === Z.SUPER;
  if (expressed.highway) {
    suppressed.dorsal = true;
    reasoning.push({
      trait: 'highway',
      message: expressed.cappuccino
        ? 'Cappuccino + Highway, one copy of each on the same gene. Never a super.'
        : expressed.sable
          ? 'Sable + Highway, clean stripe over a darker Sable body. One copy of each, never a super.'
          : highwaySuper
            ? 'Super Highway, clean stripe and very clean sides. Some breeders report nostril and health problems (not established).'
            : 'Highway, continuous clean dorsal stripe with clean sides.',
    });
  }

  // Lilly White, bright body highlights.
  if (expressed.lilly_white) {
    palette.accent    = TRAITS_BY_ID.lilly_white.visual.floodColor;
    reasoning.push({
      trait: 'lilly_white',
      message: mend.lilly_white === Z.SUPER
        ? 'Super Lilly White is embryonic-lethal, the rendered preview is illustrative only.'
        : 'Lilly White, irregular bright white body highlights and a clean break along the dorsum.',
    });
  }

  // White Wall, clean white belly band.
  if (expressed.white_wall) {
    palette.belly = TRAITS_BY_ID.white_wall.visual.bandHex;
    reasoning.push({
      trait: 'white_wall',
      message: 'White Wall, clean white band along the lower lateral body.',
    });
  }

  // Empty Back, suppresses dorsal pattern.
  if (expressed.empty_back) {
    suppressed.dorsal = true;
    reasoning.push({
      trait: 'empty_back',
      message: 'Empty Back, clears the dorsal pattern entirely, leaving a clean back.',
    });
  }

  // ---- 5. Resolve polygenic pattern intensity (0-4), applying suppressions.
  const patternsIn = selections.patterns || {};
  const patternIntensity = {};
  PATTERN_TRAITS.forEach((p) => {
    let val = Math.max(0, Math.min(4, patternsIn[p.id] || 0));
    if (p.id === 'phantom' && val > 0) {
      // Phantom also desaturates the palette overall.
      const amt = 0.1 * val;
      palette.base   = desaturateHex(palette.base, amt);
      palette.shadow = desaturateHex(palette.shadow, amt);
      palette.dorsum = desaturateHex(palette.dorsum, amt);
    }
    // Sable reads with less pattern; Super Sable with even less.
    if (expressed.sable && p.id !== 'phantom' && p.id !== 'patternless') {
      val = Math.max(0, val - (sableSuper ? 2 : 1));
    }
    // Highway keeps the sides clean.
    if (expressed.highway && ['harlequin', 'flame', 'tiger', 'brindle', 'dalmatian'].includes(p.id)) {
      val = Math.max(0, val - (highwaySuper ? 2 : 1));
    }
    // Patternless or dorsal suppression mutes dorsal-touching patterns.
    if (suppressed.dorsal && (p.id === 'pinstripe')) {
      val = Math.min(val, 1);
    }
    if (p.id === 'patternless' && val > 2) {
      suppressed.lateral = true;
      suppressed.dorsal = true;
    }
    patternIntensity[p.id] = val;
  });

  // ---- 6. Accents, pass-through.
  const accentsIn = selections.accents || {};
  const accents = {};
  ACCENT_TRAITS.forEach((a) => {
    accents[a.id] = !!accentsIn[a.id];
  });

  // ---- 7. Structural.
  const structural = {
    crest_size: 'normal',
    tail:       'present',
    eye_color:  'gold',
    crowned:    false,
    furred:     false,
    ...(selections.structural || {}),
  };

  const eyeMap = {
    gold:   '#d4a93b',
    copper: '#b4571a',
    silver: '#b8c2c8',
    grey:   '#707478',
    red:    '#9e2a2a',
  };
  palette.eye = eyeMap[structural.eye_color] || '#d4a93b';
  if (suppressed.warmPigment) palette.eye = '#8e9296';

  // ---- 8. Sort active morphs with Mendelian first, then patterns.
  Object.entries(patternIntensity).forEach(([id, v]) => {
    if (v > 0) activeMorphs.push({ id, label: TRAITS_BY_ID[id]?.name || id, intensity: v, category: 'pattern' });
  });
  Object.entries(accents).forEach(([id, on]) => {
    if (on) activeMorphs.push({ id, label: TRAITS_BY_ID[id]?.name || id, category: 'accent' });
  });

  return {
    baseColorId,
    baseColor,
    palette,
    expressed,
    patternIntensity,
    accents,
    structural,
    environmental: env,
    fireFactor,
    suppressed,
    reasoning,
    activeMorphs,
  };
}
