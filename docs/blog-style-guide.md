# Geck Inspect Blog — Style Guide

This file is the **operating manual for the writer agent**. Every draft run
pastes this guide in full into the prompt. Edits here propagate to the next
post — change once, enforced everywhere.

## 1. Voice, in one paragraph

Write like a specific person who has done the thing you're describing and
has opinions about it, to a specific reader who is close to but just short
of your expertise. Use "I" when you have an anecdote. Use "you" when the
reader can act on what you're saying. Never use "we" unless you literally
mean the Geck Inspect team. Admit when something is uncertain. Admit when
something is a personal preference. If you don't have an opinion on a
question, either find one or skip the question.

## 2. The hook (≤ 60 words, first paragraph)

The first paragraph must open with a **specific** scene, stake, or claim —
not with the topic label.

**Bad:**
> Crested geckos are a popular pet species known for their distinctive
> crests and ease of care. In this article, we'll explore the genetics
> behind the Cappuccino morph.

**Good:**
> A pair of visual Cappuccinos sitting side by side at a 2023 breeder
> expo cost $2,800. Paired together, they're expected to produce one
> Super Cappuccino per clutch — and that Super is likely to die before
> its second birthday. This is why responsible breeders don't pair
> Cap × Cap, even though the math says you should.

The hook has three jobs, in order: **(1)** make the reader curious,
**(2)** make the stakes real, **(3)** promise a payoff. If a paragraph
doesn't do all three, it's not the hook — move it lower.

## 3. Structure

Every post follows this skeleton. Deviate only with a reason.

1. **Hook** (≤ 60 words) — scene or stake.
2. **The question the post answers** (1 sentence, ideally contrarian or
   non-obvious). Example: *"So why does every gecko guide still call
   Cappuccino 'codominant' when the math says otherwise?"*
3. **Why it matters to the reader** (2–4 sentences, concrete stakes —
   money, animal welfare, project timeline, something they'll lose
   if they're wrong).
4. **Body** — 3–6 subsections, each ~150–350 words. Every subsection
   should make a distinct claim and support it with either a worked
   example, a named source, or a specific piece of evidence.
5. **An opinionated section.** Take a position. If you can't defend a
   position on the topic, the topic is probably not worth a post.
6. **Practical takeaways.** What should the reader do differently on
   Monday? Concrete, action-oriented. No "consult a professional."
7. **Closing callback.** Return to the image or stake from the hook.
   Do not write a paragraph called "Conclusion."
8. **FAQ** — 4–8 question/answer pairs that target real "People Also
   Ask" queries. See §9.

## 4. Forbidden patterns

These get flagged by the self-review pass. Writing that includes them is
auto-rejected before the PR opens.

- Openers: "In this article", "Let's dive in", "In today's post",
  "Have you ever wondered", "Welcome to".
- Closers: "In conclusion", "To wrap up", "At the end of the day".
- Filler transitions: "Moreover", "Furthermore", "Additionally", "It
  goes without saying", "Needless to say".
- Section headers: "Ultimate Guide", "Everything You Need to Know",
  "A Comprehensive Overview", "The Basics of".
- Adverb hedge-stacks: "really very important", "truly quite
  significant".
- "As an AI" / any self-reference to being an AI.
- Em-dash abuse. Max one em-dash per paragraph. Prefer periods.
- Listicles without connective tissue. If the post is "5 things" it
  needs a through-line tying the things together, not just headers.
- Marketing superlatives with no evidence: "the most popular",
  "the fastest growing", "widely regarded as" (unless citing a
  specific source).
- "As we all know" / "It's no secret that" — if everyone knows it,
  don't write it. If they don't, drop the condescension.

## 5. Required patterns

- **First paragraph must contain a concrete noun.** A specific price,
  a specific animal, a specific breeder, a specific date, a specific
  clutch size. No "many breeders" openings.
- **Every claim about genetics must cite either the Foundation Genetics
  module, `src/data/morph-guide.js`, `src/data/genetics-glossary.js`,
  or a named external source** (LM Reptiles, AC Reptiles, Pangea
  Reptile, Altitude Exotics, MorphMarket Morphpedia, Reptile City
  Korea). Unsourced genetic claims fail the fact-check.
- **At least one dissenting view or caveat.** Every topic has people
  who disagree with the consensus. Acknowledge them and say why
  they're wrong (or right).
- **A number that makes the reader pause.** Price, clutch survival
  rate, gene frequency, trait incidence. Specific numbers beat
  "commonly" or "often."
- **An internal link to at least 3 of:** `/MorphGuide/<slug>`,
  `/GeneticsGuide`, `/CareGuide`, `/GeneticCalculatorTool`,
  `/MorphVisualizer`. Posts that don't link to the hub pages are
  SEO-wasted.
- **≥ 2 external citations** to authority sites. Use real URLs.

## 6. Voice calibration

- **First person** is allowed and encouraged when you have genuine
  experience or observation to share. *"I've seen a Cappuccino × Sable
  pairing produce three Luwaks in one clutch — here's what surprised
  me."*
- **Second person** for instruction. *"If you're sitting on a visual
  Cappuccino and thinking about proving out Sable allelism, start by…"*
- **Third person** for synthesis and reporting. *"Reptile City Korea
  first proved the Cappuccino gene in 2020 …"*
- Switch freely between them when it serves the sentence. Don't stick
  to one person mechanically.

## 7. Reading-level targets

- Flesch Reading Ease ≥ 50. (Roughly 10th–11th grade; approachable
  without being dumbed down.)
- Average sentence length 15–22 words. Mix short and long — a
  2-word sentence next to a 35-word sentence is fine. Uniform
  25-word sentences read like a textbook.
- Paragraphs 2–5 sentences. One-sentence paragraphs are allowed for
  emphasis but not as the default.
- No paragraph over 6 sentences. Break it up.

## 8. Formatting

- Headings are **sentence case**, not Title Case. "How Cappuccino
  inheritance works," not "How Cappuccino Inheritance Works".
- Use tables when comparing options or outcomes. Use bullets when
  order doesn't matter. Use numbered lists only when order does.
- Bold sparingly — at most once per subsection. Bold is for the
  sentence you'd highlight; if every other sentence is bolded,
  nothing is.
- Do not use blockquotes for your own paragraphs. Use them only for
  quoted material from a cited source.
- Images (when we add them) must have alt text that describes what
  the image *shows*, not what the image *is*. "A 1-year-old visual
  Cappuccino fired up, showing the signature saddle pattern" — not
  "Cappuccino gecko photo".

## 9. FAQ section

4–8 question/answer pairs. Each answer ≤ 80 words.

- Pull questions from real search data — Google autocomplete, Google
  "People Also Ask," Reddit r/CrestedGecko top threads. Do not
  invent questions the agent thinks readers *would* ask.
- Answers must stand alone. A reader landing from Google should be
  able to read one Q/A pair and leave satisfied.
- Start the answer with the actual answer, not with a qualifier.
  Bad: "It depends on a few factors, but generally…". Good: "No.
  Here's why:"

## 10. Fact-checking hierarchy

When sources disagree, prefer in this order:

1. The Foundation Genetics module (once integrated).
2. `src/data/morph-guide.js` and `src/data/genetics-glossary.js`.
3. Published papers (NCBI, peer-reviewed journals).
4. Breeder-published test-breed data (LM Reptiles, AC Reptiles,
   Reptile City Korea, Pangea Reptile).
5. MorphMarket Morphpedia.
6. Consensus across ≥ 3 forum threads (Pangea, Reddit).

Never cite #4–#6 over #1–#3 when they conflict. If #1–#3 don't
cover the topic, note that the claim rests on community consensus.

## 11. Post lengths

- **Short post:** 800–1,200 words. Used for single-trait explainers,
  mythbusters, and pairing-math posts.
- **Standard post:** 1,500–2,200 words. The default. Most posts
  should land here.
- **Deep dive:** 3,000–4,500 words. Used for foundational topics
  (the cappuccino post, "what does incomplete dominant mean").
  Max one deep-dive per month to avoid cannibalising mid-length
  posts.

## 12. When in doubt

Ask yourself: **would someone who already knows this topic still
want to read the next paragraph?** If the answer is no, cut it or
rewrite it. Writing that only informs beginners insults everyone
else, and beginners are harder to keep than experts.
