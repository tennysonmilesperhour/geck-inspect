/**
 * assistantActions, the client-orchestrated action registry for the
 * GeckoGenius assistant (BreederConsultant page).
 *
 * How it works (v1, no server-side tool use):
 * 1. The page appends buildActionProtocolPrompt() to the system prompt.
 *    It tells the model that when the user asks it to DO something it
 *    must answer with a single JSON block:
 *      {"action": "log_weight", "args": {...}, "say": "..."}
 * 2. The page runs parseAssistantAction() over the raw LLM reply. If a
 *    registered action comes back, it calls validate(args, ctx) here.
 *    Validation resolves gecko_name against the user's collection with
 *    fuzzy matching; ambiguous names return candidates instead of a
 *    silent guess.
 * 3. Write actions (log_*) are NEVER executed straight away. The page
 *    renders a confirmation card built from describe() and only calls
 *    execute() after the user taps Confirm. Read actions (list_due,
 *    find_geckos) run immediately since they change nothing.
 * 4. execute() returns { message, undo? }. When undo is present the
 *    page can offer a one-tap "Undo" that deletes the record it just
 *    created (and restores the gecko.weight_grams mirror for weights).
 *
 * Only the five actions below exist. Nothing free-form ever executes.
 *
 * Entity shapes (verified against migrations + FieldMode):
 *   WeightRecord  { gecko_id, weight_grams, record_date }  (+ mirror to gecko.weight_grams)
 *   ShedRecord    { animal_id, date, quality }   quality CHECK: complete | partial | retained_toes | retained_eye_caps | unknown
 *   FeedingRecord { animal_id, date, food_type, accepted }
 *   Egg           { breeding_plan_id, lay_date, hatch_date_expected, status, archived }
 *   FeedingGroup  { label, name, interval_days, last_fed_date }
 */
import {
  Gecko,
  WeightRecord,
  ShedRecord,
  FeedingRecord,
  Egg,
  BreedingPlan,
  FeedingGroup,
} from '@/entities/all';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import { addDays, differenceInCalendarDays } from 'date-fns';

// ---------------------------------------------------------------------------
// Fuzzy gecko-name resolution
// ---------------------------------------------------------------------------

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein distance, small inputs only (gecko names). */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Resolve a spoken/typed name to one gecko in the user's collection.
 * Match ladder: exact, prefix, substring (either direction), then
 * typo tolerance (Levenshtein scaled to query length).
 *
 * Returns { gecko } on a unique hit, { candidates: [...] } when more
 * than one gecko fits, or { error: 'not_found' | 'no_name' | 'empty_collection' }.
 */
export function resolveGecko(geckoName, geckos) {
  const query = normalizeText(geckoName);
  if (!query) return { error: 'no_name' };
  const active = (geckos || []).filter((g) => g && g.name && !g.archived);
  if (active.length === 0) return { error: 'empty_collection' };

  const scored = active.map((g) => ({ g, n: normalizeText(g.name) }));
  let matches = scored.filter((x) => x.n === query);
  if (matches.length === 0) {
    matches = scored.filter((x) => x.n.startsWith(query) || query.startsWith(x.n));
  }
  if (matches.length === 0) {
    matches = scored.filter((x) => x.n.includes(query) || query.includes(x.n));
  }
  if (matches.length === 0) {
    const tolerance = Math.max(1, Math.floor(query.length / 4));
    matches = scored
      .map((x) => ({ ...x, d: levenshtein(x.n, query) }))
      .filter((x) => x.d <= tolerance)
      .sort((a, b) => a.d - b.d);
  }
  if (matches.length === 1) return { gecko: matches[0].g };
  if (matches.length > 1) return { candidates: matches.slice(0, 5).map((x) => x.g) };
  return { error: 'not_found' };
}

/** Shared validate step: turn args.gecko_name into a gecko or a failure. */
function requireGecko(args, ctx) {
  const res = resolveGecko(args?.gecko_name, ctx?.geckos || []);
  if (res.gecko) return { gecko: res.gecko };
  if (res.candidates) {
    const names = res.candidates.map((g) => g.name).join(', ');
    return {
      fail: {
        ok: false,
        reason: 'ambiguous',
        candidates: res.candidates,
        message: `A few geckos in your collection could be "${args?.gecko_name}": ${names}. Which one did you mean?`,
      },
    };
  }
  if (res.error === 'empty_collection') {
    return {
      fail: {
        ok: false,
        reason: 'invalid',
        message: 'I could not find any geckos in your collection yet. Add one on the My Geckos page and I can start logging for it.',
      },
    };
  }
  return {
    fail: {
      ok: false,
      reason: 'invalid',
      message: `I could not find a gecko named "${args?.gecko_name || ''}" in your collection. Try the exact name from My Geckos, or ask me to search your collection.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Shed quality normalization (DB CHECK constraint on shed_records.quality)
// ---------------------------------------------------------------------------

const SHED_QUALITY_VALUES = ['complete', 'partial', 'retained_toes', 'retained_eye_caps', 'unknown'];

const SHED_QUALITY_LABELS = {
  complete: 'clean',
  partial: 'partial',
  retained_toes: 'stuck (toes)',
  retained_eye_caps: 'stuck (eye caps)',
  unknown: 'unspecified',
};

function normalizeShedQuality(quality) {
  if (quality === undefined || quality === null || quality === '') return 'complete';
  const s = String(quality).toLowerCase();
  if (SHED_QUALITY_VALUES.includes(s)) return s;
  if (s.includes('eye')) return 'retained_eye_caps';
  if (s.includes('toe') || s.includes('stuck') || s.includes('retain')) return 'retained_toes';
  if (s.includes('partial') || s.includes('incomplete')) return 'partial';
  if (s.includes('clean') || s.includes('complete') || s.includes('full') || s.includes('good')) return 'complete';
  return null;
}

// ---------------------------------------------------------------------------
// list_due helpers
// ---------------------------------------------------------------------------

const SHED_STALE_DAYS = 45;

async function listDueEggs(ctx) {
  const [eggs, plans] = await Promise.all([
    Egg.filter({ status: 'Incubating' }).catch(() => []),
    BreedingPlan.list().catch(() => []),
  ]);
  const geckoName = (id) => (ctx.geckos || []).find((g) => g.id === id)?.name || null;
  const pairName = (planId) => {
    const plan = (plans || []).find((p) => p.id === planId);
    if (!plan) return 'Unknown pairing';
    return `${geckoName(plan.sire_id) || 'Sire'} x ${geckoName(plan.dam_id) || 'Dam'}`;
  };

  const live = (eggs || []).filter((e) => !e.archived);
  const today = new Date();
  const rows = live
    .filter((e) => e.hatch_date_expected)
    .map((e) => ({ e, days: differenceInCalendarDays(parseLocalDate(e.hatch_date_expected), today) }))
    .filter((x) => x.days <= 14)
    .sort((a, b) => a.days - b.days);
  const noDate = live.filter((e) => !e.hatch_date_expected).length;

  if (rows.length === 0) {
    if (noDate > 0) {
      return `No eggs are expected to hatch in the next 14 days. You do have ${noDate} incubating egg${noDate === 1 ? '' : 's'} without an expected hatch date, so it may be worth setting those on the Breeding page.`;
    }
    return 'No eggs are expected to hatch in the next 14 days. A quiet incubator is a happy incubator.';
  }

  const lines = rows.slice(0, 15).map(({ e, days }) => {
    const when = days < 0
      ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
      : days === 0
        ? 'due today'
        : `due in ${days} day${days === 1 ? '' : 's'}`;
    return `- **${pairName(e.breeding_plan_id)}**: laid ${e.lay_date || 'date unknown'}, expected ${e.hatch_date_expected} (${when})`;
  });
  const more = rows.length > 15 ? `\n\n...and ${rows.length - 15} more.` : '';
  return `Here is your incubator calendar for the next 14 days:\n\n${lines.join('\n')}${more}`;
}

async function listDueFeeding(ctx) {
  const groups = await FeedingGroup.list().catch(() => []);
  if (!groups || groups.length === 0) {
    return 'You have no feeding groups set up yet. Create one on the Husbandry page and I can keep an eye on the schedule for you.';
  }
  const today = todayLocalISO();
  const groupTitle = (g) => `Group ${g.label}${g.name ? ` (${g.name})` : ''}`;
  const countFor = (g) => (ctx.geckos || []).filter((x) => x.feeding_group_id === g.id && !x.archived).length;
  const rows = groups
    .filter((g) => g.interval_days)
    .map((g) => {
      if (!g.last_fed_date) return { g, days: null };
      const fedToday = g.last_fed_date === today;
      const next = addDays(parseLocalDate(g.last_fed_date), g.interval_days);
      return { g, days: fedToday ? g.interval_days : differenceInCalendarDays(next, new Date()) };
    });

  const due = rows
    .filter((r) => r.days !== null && r.days <= 0)
    .sort((a, b) => a.days - b.days);
  const neverFed = rows.filter((r) => r.days === null);

  if (due.length === 0 && neverFed.length === 0) {
    const upcoming = rows
      .filter((r) => r.days !== null && r.days > 0)
      .sort((a, b) => a.days - b.days)[0];
    if (upcoming) {
      return `Nothing is overdue. Next up is **${groupTitle(upcoming.g)}** in ${upcoming.days} day${upcoming.days === 1 ? '' : 's'}.`;
    }
    return 'Nothing is overdue and no feedings are scheduled. All quiet on the CGD front.';
  }

  const lines = due.map(({ g, days }) => {
    const when = days === 0 ? 'due today' : `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
    const count = countFor(g);
    return `- **${groupTitle(g)}**: ${when}, ${count} gecko${count === 1 ? '' : 's'}, last fed ${g.last_fed_date}`;
  });
  for (const { g } of neverFed) {
    const count = countFor(g);
    lines.push(`- **${groupTitle(g)}**: never marked fed, ${count} gecko${count === 1 ? '' : 's'}`);
  }
  return `Feeding groups that need attention:\n\n${lines.join('\n')}`;
}

async function listDueSheds(ctx) {
  const sheds = await ShedRecord.filter({}, '-date', 500).catch(() => []);
  const lastByAnimal = {};
  for (const s of sheds || []) {
    if (s.animal_id && s.date && (!lastByAnimal[s.animal_id] || s.date > lastByAnimal[s.animal_id])) {
      lastByAnimal[s.animal_id] = s.date;
    }
  }
  const active = (ctx.geckos || []).filter((g) => !g.archived && g.name);
  if (active.length === 0) {
    return 'I could not find any geckos in your collection yet, so there is no shed history to check.';
  }
  const NEVER = 100000;
  const stale = active
    .map((g) => {
      const last = lastByAnimal[g.id];
      return { g, last, days: last ? differenceInCalendarDays(new Date(), parseLocalDate(last)) : null };
    })
    .filter((x) => x.days === null || x.days >= SHED_STALE_DAYS)
    .sort((a, b) => (b.days ?? NEVER) - (a.days ?? NEVER));

  if (stale.length === 0) {
    return `Every gecko has a shed logged within the last ${SHED_STALE_DAYS} days. Your record keeping is on point.`;
  }
  const lines = stale.slice(0, 15).map(({ g, last, days }) => (
    last
      ? `- **${g.name}**: last shed logged ${last} (${days} days ago)`
      : `- **${g.name}**: no shed ever logged`
  ));
  const more = stale.length > 15 ? `\n\n...and ${stale.length - 15} more.` : '';
  return `${stale.length} gecko${stale.length === 1 ? ' has' : 's have'} no shed logged in the last ${SHED_STALE_DAYS} days:\n\n${lines.join('\n')}${more}\n\nCresties shed roughly every 2 to 4 weeks, so a long gap usually just means it was not logged.`;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Each action:
 *   kind      'write' (needs a confirmation card) or 'read' (runs immediately)
 *   validate  (args, ctx) -> { ok: true, normalized } or
 *             { ok: false, reason: 'invalid' | 'ambiguous', message, candidates? }
 *   describe  (normalized) -> short text for the confirmation chip
 *   execute   (normalized, ctx) -> { message, undo? } where undo deletes
 *             what was just created
 * ctx is { geckos, user }.
 */
export const ACTIONS = {
  log_weight: {
    kind: 'write',
    validate(args = {}, ctx = {}) {
      const grams = Number(args.grams);
      if (!Number.isFinite(grams) || grams <= 0 || grams > 150) {
        return {
          ok: false,
          reason: 'invalid',
          message: 'That weight does not look right. Crested geckos usually land between 1g and 80g, so give me a number like "14.5".',
        };
      }
      const { gecko, fail } = requireGecko(args, ctx);
      if (fail) return fail;
      return { ok: true, normalized: { gecko, grams: Math.round(grams * 10) / 10 } };
    },
    describe(n) {
      return `Log ${n.grams}g for ${n.gecko.name}`;
    },
    async execute(n) {
      const record = await WeightRecord.create({
        gecko_id: n.gecko.id,
        weight_grams: n.grams,
        record_date: todayLocalISO(),
      });
      const previousWeight = n.gecko.weight_grams ?? null;
      // WeightRecord is the source of truth; the gecko row mirrors the
      // latest value so cards and the passport refresh immediately.
      await Gecko.update(n.gecko.id, { weight_grams: n.grams });
      return {
        message: `Logged **${n.grams}g** for **${n.gecko.name}** today.`,
        undo: async () => {
          await WeightRecord.delete(record.id);
          await Gecko.update(n.gecko.id, { weight_grams: previousWeight });
        },
      };
    },
  },

  log_shed: {
    kind: 'write',
    validate(args = {}, ctx = {}) {
      const quality = normalizeShedQuality(args.quality);
      if (!quality) {
        return {
          ok: false,
          reason: 'invalid',
          message: `I did not recognize "${args.quality}" as a shed quality. I can log clean, partial, stuck toes, or stuck eye caps.`,
        };
      }
      const { gecko, fail } = requireGecko(args, ctx);
      if (fail) return fail;
      return { ok: true, normalized: { gecko, quality } };
    },
    describe(n) {
      return `Log a ${SHED_QUALITY_LABELS[n.quality]} shed for ${n.gecko.name}`;
    },
    async execute(n) {
      const record = await ShedRecord.create({
        animal_id: n.gecko.id,
        date: todayLocalISO(),
        quality: n.quality,
      });
      return {
        message: `Logged a **${SHED_QUALITY_LABELS[n.quality]}** shed for **${n.gecko.name}** today.`,
        undo: async () => {
          await ShedRecord.delete(record.id);
        },
      };
    },
  },

  log_feeding: {
    kind: 'write',
    validate(args = {}, ctx = {}) {
      const accepted = args.accepted === undefined || args.accepted === null
        ? true
        : args.accepted === true || String(args.accepted).toLowerCase() === 'true';
      const { gecko, fail } = requireGecko(args, ctx);
      if (fail) return fail;
      return { ok: true, normalized: { gecko, accepted } };
    },
    describe(n) {
      return n.accepted
        ? `Log a feeding for ${n.gecko.name} (ate)`
        : `Log a refused feeding for ${n.gecko.name}`;
    },
    async execute(n) {
      const record = await FeedingRecord.create({
        animal_id: n.gecko.id,
        date: todayLocalISO(),
        accepted: n.accepted,
        notes: n.accepted ? null : 'Refused, logged via GeckoGenius',
      });
      return {
        message: n.accepted
          ? `Logged a feeding for **${n.gecko.name}** today.`
          : `Logged a **refused** feeding for **${n.gecko.name}** today. Keep an eye on it; a refusal or two is normal, a streak is worth a closer look.`,
        undo: async () => {
          await FeedingRecord.delete(record.id);
        },
      };
    },
  },

  list_due: {
    kind: 'read',
    validate(args = {}) {
      const raw = String(args.what || '').toLowerCase();
      let what = null;
      if (raw.startsWith('egg') || raw.includes('hatch')) what = 'eggs';
      else if (raw.startsWith('feed') || raw.includes('food')) what = 'feeding';
      else if (raw.startsWith('shed')) what = 'sheds';
      if (!what) {
        return {
          ok: false,
          reason: 'invalid',
          message: 'I can check three things for you: eggs, feeding, or sheds. Which would you like?',
        };
      }
      return { ok: true, normalized: { what } };
    },
    describe(n) {
      if (n.what === 'eggs') return 'Check eggs due in the next 14 days';
      if (n.what === 'feeding') return 'Check overdue feeding groups';
      return 'Check geckos overdue for a shed';
    },
    async execute(n, ctx = {}) {
      if (n.what === 'eggs') return { message: await listDueEggs(ctx) };
      if (n.what === 'feeding') return { message: await listDueFeeding(ctx) };
      return { message: await listDueSheds(ctx) };
    },
  },

  find_geckos: {
    kind: 'read',
    validate(args = {}) {
      const query = String(args.query || '').trim();
      if (!query) {
        return {
          ok: false,
          reason: 'invalid',
          message: 'Tell me what to look for, a name or a morph like "Lilly White".',
        };
      }
      return { ok: true, normalized: { query } };
    },
    describe(n) {
      return `Search your collection for "${n.query}"`;
    },
    async execute(n, ctx = {}) {
      const tokens = normalizeText(n.query).split(' ').filter(Boolean);
      const active = (ctx.geckos || []).filter((g) => !g.archived);
      const morphText = (g) => {
        const tags = Array.isArray(g.morph_tags)
          ? g.morph_tags.map((t) => (typeof t === 'string' ? t : t?.name || '')).filter(Boolean)
          : [];
        return tags.length ? tags.join(', ') : (g.morphs_traits || '');
      };
      const haystack = (g) => normalizeText(
        [g.name, g.morphs_traits, morphText(g), g.gecko_id_code, g.sex].filter(Boolean).join(' ')
      );
      const matches = active.filter((g) => {
        const h = haystack(g);
        return tokens.every((t) => h.includes(t));
      });
      if (matches.length === 0) {
        return { message: `No geckos in your collection matched "${n.query}". Try a name or a morph from the My Geckos page.` };
      }
      const lines = matches.slice(0, 12).map((g) => {
        const bits = [g.sex || 'sex unknown', morphText(g) || 'morphs not set'];
        if (g.weight_grams != null) bits.push(`${g.weight_grams}g`);
        return `- **${g.name}**: ${bits.join(', ')}`;
      });
      const more = matches.length > 12 ? `\n\n...and ${matches.length - 12} more.` : '';
      return {
        message: `Found ${matches.length} match${matches.length === 1 ? '' : 'es'} for "${n.query}":\n\n${lines.join('\n')}${more}`,
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Prompt protocol + response parsing
// ---------------------------------------------------------------------------

/**
 * System prompt addition that teaches the model the JSON action protocol.
 * Includes a roster of the user's gecko names so the model can echo real
 * names back (the fuzzy matcher still has the final say).
 */
export function buildActionProtocolPrompt(geckos) {
  const names = (geckos || [])
    .filter((g) => !g.archived && g.name)
    .map((g) => g.name)
    .slice(0, 80);
  const roster = names.length
    ? `The user's collection includes these geckos: ${names.join(', ')}.`
    : 'The user has no geckos in their collection yet.';

  return `You can also take actions on the user's own collection. ONLY these five actions exist:
1. log_weight, args {"gecko_name": string, "grams": number}. Records today's weight in grams.
2. log_shed, args {"gecko_name": string, "quality": "complete" | "partial" | "retained_toes" | "retained_eye_caps"}. quality is optional and defaults to "complete".
3. log_feeding, args {"gecko_name": string, "accepted": boolean}. accepted is optional and defaults to true; use false when the gecko refused.
4. list_due, args {"what": "eggs" | "feeding" | "sheds"}. eggs = expected hatches in the next 14 days, feeding = overdue feeding groups, sheds = geckos with no recent shed logged.
5. find_geckos, args {"query": string}. Searches the user's collection by name or morph.

When the user asks you to DO one of these things (log something, check what is due, search their collection), respond with ONLY a single JSON code block in exactly this shape and nothing else:

\`\`\`json
{"action": "log_weight", "args": {"gecko_name": "Luna", "grams": 14.5}, "say": "14.5g for Luna, nice steady growth. Confirm below and it goes in the book."}
\`\`\`

Rules for actions:
- "say" is one short, friendly sentence in your usual voice. The app shows it next to a confirmation card, so never ask the user to type yes or no.
- Use the gecko's name as the user gave it; the app resolves it against their collection.
- Never invent actions outside the five above, and never wrap a normal answer in JSON.
- If a required value is missing (for example a weight with no number), ask for it in plain language instead of emitting JSON.
- For anything else (genetics, pairings, care, market values), answer normally in markdown with no JSON block.

${roster}`;
}

/**
 * Pull an action JSON block out of a raw LLM reply.
 * Tries fenced \`\`\`json blocks first, then a bare {"action": ...}
 * object found by balanced-brace scanning. Returns
 * { name, args, say } or null when the reply is just prose.
 */
export function parseAssistantAction(text) {
  if (!text || typeof text !== 'string') return null;
  const candidates = [];
  const fence = /```(?:json)?\s*([\s\S]*?)```/g;
  let m;
  while ((m = fence.exec(text)) !== null) candidates.push(m[1]);
  const bareIdx = text.search(/\{\s*"action"/);
  if (bareIdx !== -1) candidates.push(extractBalancedObject(text, bareIdx));

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed && typeof parsed.action === 'string' && ACTIONS[parsed.action]) {
        return {
          name: parsed.action,
          args: (parsed.args && typeof parsed.args === 'object') ? parsed.args : {},
          say: typeof parsed.say === 'string' ? parsed.say : '',
        };
      }
    } catch {
      // not valid JSON, keep trying the next candidate
    }
  }
  return null;
}

/** Slice a balanced {...} object out of text starting at `start`. */
function extractBalancedObject(text, start) {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
