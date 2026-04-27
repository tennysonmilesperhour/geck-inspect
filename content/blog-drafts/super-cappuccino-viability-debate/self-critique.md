
**Weakest claims to fact-check:**

1. The clutch math section (two eggs per clutch, three clutches per season) is a reasonable approximation for the species but I don't have a canonical corpus source for those specific numbers — a reviewer should verify against husbandry literature or the CareGuide data before publish.

2. The "30% more eggs fail" figure in the breeding math section is a hypothetical I invented to illustrate the risk. It is clearly framed as a hypothetical ("say, 30%"), but a reviewer might want to either anchor it to real reported data or remove it to avoid the number being taken out of context.

3. The Frappuccino price range ($1,500–$3,500) comes from morph-guide.js and is used directly — that's solid. The Cappuccino visual price range ($400–$1,200) also comes from morph-guide.js. Good.

4. The statement "confirmed lethal, confirmed embryonic" for Super Lilly White is supported by the corpus (genetics-sections.jsx, morph-guide.js, genetics-glossary.js). Solid.

5. I claim Frappuccinos "do hatch, live, and survive" — this is consistent with the corpus framing ("Frappuccinos exist and are bred") but is technically community consensus rather than a controlled study. Flagged but defensible.

**Style-guide struggles:**

- The opinionated section ("My actual position on this") risks being too measured — the style guide calls for taking a position. I took one (Cap × Cap is defensible but requires documentation; the "scam" label is wrong), but a reviewer could argue I hedged too much. I don't think I did, but it's the section most at risk of revision.

- Em-dash usage: I checked and used em-dashes sparingly. One paragraph in the "Lilly White comparison" section has one. Should be compliant.

- The hook is 60 words exactly at the boundary. Worth a word-count check.

- I don't have a concrete breeder name attached to a specific Cappuccino breakthrough the way the Lilly White section names Anthony Caponetto. The corpus doesn't supply a Cappuccino proven-by source with a name, so I left it out rather than fabricate one. Reviewer should verify if a named source exists and insert it.


---

## Automated reviewer notes

## Review Critique

### (a) Forbidden-pattern violations

**"We" misuse.** The phrase "We're working from breeder reports, a handful of YouTube videos, and a lot of forum opinions" uses "we" without referring to the Geck Inspect team. Per §1, "we" is reserved for the Geck Inspect team. Rewrite as first person or third person.

**Bold overuse.** The practical takeaways section opens four consecutive paragraphs with bolded sentences ("If you have a visual Cappuccino…", "If you want to produce Frappuccino…", "If you're buying a Frappuccino…", "Don't avoid Cappuccino entirely."). The style guide permits bold at most once per subsection. Every sentence bolded means nothing is bolded.

**Missing internal links.** The post contains zero links to `/MorphGuide/<slug>`, `/GeneticsGuide`, `/CareGuide`, `/GeneticCalculatorTool`, or `/MorphVisualizer`. Style §5 requires at least three. This is a hard requirement.

**Fewer than 2 external citations.** No external URLs appear anywhere in the draft. Style §5 requires ≥ 2 links to authority sites (LM Reptiles, AC Reptiles, Pangea Reptile, etc.).

---

### (b) Claims not supported by the fact-check corpus

**Clutch size figure is unsupported.** The body states "a healthy female Cappuccino lays two eggs per clutch (a normal range for the species)." Neither morph-guide.js, genetics-glossary.js, genetics-sections.jsx, nor genetics-jsonld.js contains clutch-size data. This is an unsourced biological claim presented as fact. Either cite an external authority or flag it as approximate.

**Lilly White discovery date and naming are wrong.** The draft does not directly state a date for Lilly White, but genetics-sections.jsx states it was "Discovered in 2014 by Lilly Exotics. Named for the breeder, not the color." The morph-guide.js entry states it was "Discovered by Anthony Caponetto at ACR in 2011." These two corpus sources conflict, but the draft ignores both and makes no attribution at all. If the post is going to lean on the LW comparison as a key structural argument, it should not leave this unexamined — and any future draft that names a date must reconcile the 2011 vs. 2014 discrepancy in the corpus itself.

**"Perfectly safe Cappuccino × non-carrier pairing… zero viability concerns" is stated as established fact.** The corpus language (genetics-sections.jsx) says the *conservative recommendation* is Cap × normal, but it does not assert zero concerns for that pairing. Presenting it as having "zero viability concerns" is a stronger claim than the corpus supports.

**Price range for visual Cappuccino.** The draft states $400–$1,200 for visual Cappuccino offspring. morph-guide.js lists the Cappuccino priceRange as "$400–$1,200." This checks out.

**Combined pair cost in hook ("$800–$2,400 combined").** The corpus gives Cappuccino priceRange as $400–$1,200 per animal, making the combined range $800–$2,400 arithmetically consistent. This passes.

---

### (c) Readability concerns

**Hook word count.** The hook runs approximately 75 words across two sentences before reaching the payoff question. Style §2 mandates ≤ 60 words for the first paragraph. Trim it.

**Paragraph structure in "The breeding math" section.** The paragraph beginning "Across a season, you might hatch one Frappuccino…" runs to six sentences and introduces a hypothetical 30% failure rate with no source. That specific figure ("30% more eggs fail") reads as invented and undermines the section's credibility precisely where the post is arguing against unsupported claims.

**Section header casing.** "My actual position on this" is correctly sentence case. All other headers comply. No issues beyond the missing links noted above.
