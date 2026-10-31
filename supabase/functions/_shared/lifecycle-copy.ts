// The words of the new-member lifecycle emails (plan item E2 16).
//
// enqueue_lifecycle_emails() (migration 20261015151200) decides who is due
// which step and sends the member's own facts: first name, how many geckos,
// their first gecko's name, morph and id, whether it has a sire and dam on
// record, and its weigh-ins. send-email calls lifecycleEmail() with them and
// sends the result like any other notification email.
//
// The copy lives here, not in SQL, so a wording change is one function
// deploy and the same text can be checked by tests and shown to Tennyson.
// docs/planning/lifecycle-emails-2026-10.md holds the preview he approves;
// src/lib/__tests__/lifecycleEmails.test.js fails if the two drift apart.
//
// Voice (PRODUCT.md): a trusted breeder with good records. Short sentences,
// one next step per email, real crested gecko terms, no hype, no dashes as
// punctuation. Since 20 Oct 2026 they are letters from Tennyson: a subject
// built from the member's own record, a preview line that adds to the
// subject instead of repeating it, and on day 0 and day 1 a question to
// reply to. docs/marketing/email-brain.md has the rules and the evidence.

export type LifecycleFacts = {
  first_name?: string | null;
  signed_up_at?: string | null;
  gecko_count?: number | null;
  gecko_id?: string | null;
  gecko_name?: string | null;
  gecko_morph?: string | null;
  has_sire?: boolean | null;
  has_dam?: boolean | null;
  weight_count?: number | null;
  last_weight_grams?: number | string | null;
  last_weight_date?: string | null;
};

export type LifecycleEmail = {
  // Subject line.
  title: string;
  // The line the inbox shows after the subject.
  preheader: string;
  // Plain text, paragraphs separated by a blank line.
  body: string;
  // In-app path for the button.
  url: string;
  // The button's words.
  cta: string;
};

export const LIFECYCLE_TYPES = [
  "lifecycle_day0",
  "lifecycle_day1",
  "lifecycle_day3",
  "lifecycle_day7",
  "lifecycle_day14",
] as const;

// Who signs the letters (plain text and HTML).
export const LIFECYCLE_SIGNOFF = ["Tennyson", "Geck Inspect"];

// Options the copy cannot know by itself. canReply is true when replies
// reach a mailbox Tennyson reads (EMAIL_REPLY_TO is set); without it the
// emails do not ask a question nobody would see the answer to.
export type LifecycleOptions = { canReply?: boolean };

export function isLifecycleType(type: string): boolean {
  return (LIFECYCLE_TYPES as readonly string[]).includes(type);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Member-typed text goes into a subject line, so control characters and
// line breaks are dropped and the length is capped.
function clean(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function firstName(facts: LifecycleFacts): string | null {
  const name = clean(facts.first_name, 40);
  // An address or a handle in the name field reads badly in a greeting.
  if (!name || name.includes("@")) return null;
  return name;
}

function greeting(facts: LifecycleFacts): string {
  const name = firstName(facts);
  return name ? `Hi ${name},` : "Hi,";
}

// "Mango" for the gecko, or "your gecko" when it has no name.
type GeckoWords = { name: string; Name: string; possessive: string; Possessive: string };

function geckoName(facts: LifecycleFacts): GeckoWords {
  const name = clean(facts.gecko_name, 60);
  if (!name) {
    return { name: "your gecko", Name: "Your gecko", possessive: "your gecko's", Possessive: "Your gecko's" };
  }
  const possessive = /s$/i.test(name) ? `${name}'` : `${name}'s`;
  return { name, Name: name, possessive, Possessive: possessive };
}

function grams(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n * 10) / 10} g`;
}

function shortDate(value: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : null;
}

function weighLink(facts: LifecycleFacts): string {
  const id = clean(facts.gecko_id, 64);
  if (!id) return "/MyGeckos";
  return `/log?gecko=${encodeURIComponent(id)}&type=weight`;
}

function treeLink(facts: LifecycleFacts): string {
  const id = clean(facts.gecko_id, 64);
  return id ? `/Lineage?geckoId=${encodeURIComponent(id)}` : "/Lineage";
}

const paragraphs = (...parts: Array<string | null | false>) => parts.filter(Boolean).join("\n\n");

// For a member with no gecko yet (day 0 without one, and day 1): ?add=1
// makes My Geckos open step 1 of the guided first gecko on arrival, the
// choice of adding it by photo (Morph ID) or by typing a name, instead of
// the page behind it. Since 28 Oct 2026; plain /MyGeckos before.
const FIRST_GECKO_LINK = "/MyGeckos?add=1";

function day0(facts: LifecycleFacts, ask: (line: string) => string | null): LifecycleEmail {
  const name = firstName(facts);
  const hasGecko = Number(facts.gecko_count) > 0 && Boolean(clean(facts.gecko_id, 64));

  if (!hasGecko) {
    return {
      title: name ? `${name}, start with one gecko` : "Start with one gecko",
      preheader: "A name and a morph are enough. Everything else hangs off that record.",
      body: paragraphs(
        greeting(facts),
        "I'm Tennyson. I build Geck Inspect on my own, for people who keep and breed crested geckos.",
        "The one thing worth doing today: add one gecko. A name and a morph are enough, written the way the breeder listed it, such as Lilly White, Harlequin, Dalmatian or Phantom. Not sure of the morph? Morph ID reads a top photo and a side photo and suggests the likely one. Free members get one identification a month.",
        "Once a gecko is in, the weight chart, the feeding day and the family tree all hang off that record.",
        ask("A question while I have you: what got you into crested geckos? Hit reply and tell me. I read every answer."),
      ),
      url: FIRST_GECKO_LINK,
      cta: "Add your first gecko",
    };
  }

  const g = geckoName(facts);
  if (!(Number(facts.weight_count) > 0)) {
    return {
      title: `${g.Name} is in. Next: a first weight`,
      preheader: "Weigh before a feeding, on a scale that reads to 0.1 g. It starts the growth curve.",
      body: paragraphs(
        greeting(facts),
        `I'm Tennyson, and I build Geck Inspect. ${g.Name} is already in, which is the hard part.`,
        `The next step takes a minute: weigh ${g.name} and log it in grams. Use a kitchen scale that reads to 0.1 g. Weigh before a feeding so a full belly does not pad the number.`,
        "That first number starts the growth curve, and the curve is what tells you when a female is big enough to breed. Most breeders wait for at least 40 g and 18 months.",
        ask(`A question: is ${g.name} a pet, a future breeder, or still undecided? Hit reply and tell me. I read every answer.`),
      ),
      url: weighLink(facts),
      cta: `Log ${g.possessive} weight`,
    };
  }

  return {
    title: `${g.Name} has a growth chart. Add the rest?`,
    preheader: "Name and morph are enough for each. A spreadsheet or MorphMarket export comes in at once.",
    body: paragraphs(
      greeting(facts),
      `I'm Tennyson, and I build Geck Inspect. ${g.Name} is in with a first weight, so the growth chart has already started. That is further than most people get on day one.`,
      "Next: add the rest of your collection. Name and morph are enough for each one. If you keep your animals in a spreadsheet or have a MorphMarket export, import it in one go instead.",
      ask("How many geckos do you keep? Hit reply and tell me. I read every answer, and it shapes what I build next."),
    ),
    url: "/MyGeckos",
    cta: "Add your other geckos",
  };
}

function day1(facts: LifecycleFacts, ask: (line: string) => string | null): LifecycleEmail {
  return {
    title: "The two-minute way to add your first gecko",
    preheader: "Name and morph. Hatch date, parents and photos can wait.",
    body: paragraphs(
      greeting(facts),
      "Your collection is still empty. That is normal on day one, so here is the shortest way in.",
      "Pick the gecko you know best and add its name and morph. It takes two minutes. If you still have the breeder's listing, copy the morph line from it. Hatch date, parents and photos can wait.",
      "Keeping more than a handful? Import a spreadsheet or a MorphMarket export and the whole collection comes in at once.",
      ask("If something stopped you, reply and tell me what it was. I fix what people trip on."),
    ),
    url: FIRST_GECKO_LINK,
    cta: "Add a gecko",
  };
}

function day3(facts: LifecycleFacts): LifecycleEmail | null {
  if (!clean(facts.gecko_id, 64)) return null;
  const g = geckoName(facts);
  const sire = facts.has_sire === true;
  const dam = facts.has_dam === true;

  if (sire && dam) {
    return {
      title: `${g.Possessive} family tree is started`,
      preheader: `Each generation you add is evidence for what ${g.name} may carry.`,
      body: paragraphs(
        greeting(facts),
        `${g.Name} already has a sire and a dam on record, which puts you ahead of most keepers.`,
        "Open the family tree to see it, and add grandparents if the breeder gave you them. Each generation you record is evidence for what a gecko may carry. A normal-looking gecko with an Axanthic parent carries Axanthic, and only the pedigree shows it.",
      ),
      url: treeLink(facts),
      cta: `Open ${g.possessive} family tree`,
    };
  }

  const missing = sire ? "dam" : dam ? "sire" : "sire and dam";
  return {
    title: `Who are ${g.possessive} parents?`,
    preheader: "A photo cannot show what a gecko carries. The pedigree can.",
    body: paragraphs(
      greeting(facts),
      "Parents tell you what a photo cannot. A gecko with an Axanthic parent carries Axanthic even when it looks like a normal Harlequin, and only the pedigree shows it.",
      `Add ${g.possessive} ${missing}. Names from the breeder's listing are enough; you do not need to own them. Geck Inspect draws the family tree from there, and every hatchling you log later lands on it.`,
    ),
    url: treeLink(facts),
    cta: `Open ${g.possessive} family tree`,
  };
}

function weighIn(facts: LifecycleFacts, day: 7 | 14): LifecycleEmail | null {
  if (!clean(facts.gecko_id, 64)) return null;
  const g = geckoName(facts);
  const count = Number(facts.weight_count) || 0;
  const last = grams(facts.last_weight_grams);
  const when = shortDate(facts.last_weight_date);
  const lastLine = last ? `${g.Possessive} last weight was ${last}${when ? ` on ${when}` : ""}.` : null;
  const lastShort = last ? `Last weight: ${last}${when ? ` on ${when}` : ""}.` : null;

  if (day === 7) {
    return {
      title: `Time to weigh ${g.name}`,
      preheader: count === 0
        ? "A week in and no weight yet. It is two taps."
        : `${lastShort ?? "One weight on record."} One more makes a trend.`,
      body: paragraphs(
        greeting(facts),
        count === 0
          ? `${g.Name} has been in your collection for a week and has no weight yet. Weigh in grams, before a feeding, and log it. It is two taps from the button below.`
          : `${lastLine ?? `${g.Name} has a weight on record.`} Weigh again this week and the chart turns into a trend.`,
        "Juveniles should gain steadily. A stall or a drop is often the first sign that something is off, well before you can see it.",
      ),
      url: weighLink(facts),
      cta: `Log ${g.possessive} weight`,
    };
  }

  return {
    title: `Two weeks in: weigh ${g.name} again`,
    preheader: "The rhythm: every 14 days while growing, 21 as a sub-adult, 30 as an adult.",
    body: paragraphs(
      greeting(facts),
      count >= 2
        ? `${g.Name} has ${count} weights on record, enough to draw the start of a growth curve.${last ? ` The last was ${last}${when ? ` on ${when}` : ""}.` : ""}`
        : count === 1
        ? `${lastLine ?? `${g.Name} has one weight on record.`} One more turns that number into a trend.`
        : `${g.Name} still has no weight on record. Today is a good day for the first one.`,
      // The reminder rhythm (WEIGH_IN_DAYS in src/data/husbandry-facts.js;
      // src/lib/__tests__/lifecycleEmails.test.js holds this line to it).
      `Keep the rhythm: every 14 days while a crested gecko is growing, every 21 days as a sub-adult and every 30 days as an adult. The weigh-in reminder on ${g.possessive} record tells you when the next one is due, so check it is switched on.`,
    ),
    url: weighLink(facts),
    cta: `Log ${g.possessive} weight`,
  };
}

// The email for one step, or null when the facts do not support it (for
// example a weigh-in email with no gecko to weigh). send-email skips a null.
export function lifecycleEmail(
  type: string,
  facts: LifecycleFacts | null | undefined,
  options: LifecycleOptions = {},
): LifecycleEmail | null {
  const f = facts && typeof facts === "object" ? facts : {};
  const ask = (line: string) => (options.canReply ? line : null);
  switch (type) {
    case "lifecycle_day0":
      return day0(f, ask);
    case "lifecycle_day1":
      return day1(f, ask);
    case "lifecycle_day3":
      return day3(f);
    case "lifecycle_day7":
      return weighIn(f, 7);
    case "lifecycle_day14":
      return weighIn(f, 14);
    default:
      return null;
  }
}

// The footer line that says why this email came. It mentions Weekly Gecko
// Notes without promising them: they wait for a switch and a postal address,
// and the member may already have turned them off in Settings.
export function lifecycleReason(facts: LifecycleFacts | null | undefined): string {
  const joined = shortDate(facts?.signed_up_at);
  return `You are getting this because you joined Geck Inspect${joined ? ` on ${joined}` : ""}. It is one of a few short emails in your first two weeks. After that, Weekly Gecko Notes, one short tip a week, come if you have them on. You can change that in Settings.`;
}
