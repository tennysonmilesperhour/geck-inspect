**Weakest claims that need the hardest fact-check:**

1. **North of the Border Reptiles URL**: I used northoftheborderreptiles.com as an external citation but I cannot verify this is the correct domain. The corpus confirms NOTB/Frank Payne as the proving breeder, but the actual URL should be verified before publication. If the domain is wrong or defunct, swap it for an AC Reptiles or Pangea citation that references NOTB's work.

2. **The fertility concern framing**: The corpus states "several breeders report reduced fertility when producing them" and "some reported fertility concerns" for Super Soft Scale, but it doesn't quantify this or name specific breeders. My framing is accurate to the corpus but I leaned toward treating it as a meaningful risk signal — a reviewer should assess whether the community consensus has shifted since the corpus was written, or whether more controlled data has emerged.

3. **Price figures**: I used $1,200–$3,500 for SSS and $400–$1,000 for single-copy Soft Scale, both taken directly from morph-guide.js. These are static estimates and market prices fluctuate; the reviewer should confirm these are still reasonable for the current market cycle.

4. **The "painting on" optical effect of scale structure on pattern**: This is an interpretive claim based on the mechanism of scale reduction affecting light scattering. It's not in the corpus explicitly — it's a logical inference from the scale structure description. It should be caveated more clearly or cut if the reviewer doesn't have breeder confirmation for it.

**Style-guide rules I struggled with:**
- The Punnett square tables are markdown and may need reformatting in the publish pass. I used standard GFM table syntax, but the tables are simplified (2×2 genetic crosses shown as 2 column / 2 row without full header notation) — review for accuracy in rendering.
- I may have slightly over-used bold in the "practical takeaways" section — there are four bolded phrase openers in that section. Consider trimming to two.
- The MorphMarket external citation URL is a best guess at a real Morphpedia page; the reviewer should substitute the correct URL if this resolves to a 404.

---

## Automated reviewer notes

## Review Critique

### (a) Forbidden-pattern violations

**Em-dash abuse.** Multiple paragraphs contain more than one em-dash. Examples:
- "not a 'het.'" paragraph: "That's already a one-copy Soft Scale — not a 'het.'"
- The fertility section header uses "— and what to do about it" (acceptable alone, but the same paragraph also contains "but it's manageable, not prohibitive. The alternative (never pairing two Soft Scales) means never producing a Super Soft Scale.")
- More critically, the "What actually makes the Super Soft Scale look different" section contains two em-dashes in a single paragraph: "A single copy makes the scales finer; two copies reduce them dramatically. The skin between scales is proportionally more exposed."

Actually the worst offender is the opinionated section: "The risk is real — but it's manageable, not prohibitive. The alternative (never pairing two Soft Scales) means never producing a Super Soft Scale." That paragraph alone has one em-dash plus the parenthetical, which is fine. Checking again: the section "What actually makes..." has "not a genetic phenomenon exactly — it's an optical one" and "Super Soft Scale animals with extreme harlequin pattern look distinctly different from the same pattern on a standard-scaled animal — the pattern almost reads as painted on." **Two em-dashes in one paragraph. Auto-reject trigger.**

**Section header uses Title Case inconsistently.** "Why Super Soft Scales Are Rarer Than You Think" is title case in the draft title, which is acceptable for the post title, but body headers like "My honest take: most Soft Scale projects stall because of the wrong pairing strategy, not bad luck" correctly use sentence case. No violation in the body headers.

**Filler transition.** The phrase "Let's start with the foundation" opens the first subsection body. "Let's dive in" is explicitly banned; "Let's start with" is the same register and should be flagged.

---

### (b) Claims not supported by the fact-check corpus

**Lilly White discovery date.** The opinionated section states Lilly White's lethality "has been documented" as contrast to Soft Scale's community-level evidence. The genetics-sections source says Lilly White was "Discovered: in 2014 by Lilly Exotics." The morph-guide.js says it was "Discovered by Anthony Caponetto at ACR in 2011." The draft doesn't cite a date, so no direct contradiction, but worth flagging that if the writer ever names the year elsewhere they should use the corpus value (2011, ACR).

**Super Soft Scale price range.** The draft's opening states "$1,200 to $3,500." The morph-guide.js lists the Super Soft Scale price range as "$1,200–$3,500." This matches. No violation.

**"near-leather appearance" attribution.** The draft quotes this phrase and attributes it to morph-guide.js. That language does appear in the Super Soft Scale entry. Accurate.

**Soft Scale proven by North of the Border Reptiles (Frank Payne).** The draft names "Frank Payne" as the individual at NOTB. The morph-guide.js entry says "Proven by North of the Border Reptiles (Frank Payne)." Accurate.

**No internal links present.** Style guide §5 requires links to at least 3 of the hub pages. The draft contains zero internal links to `/MorphGuide/`, `/GeneticsGuide`, `/CareGuide`, `/GeneticCalculatorTool`, or `/MorphVisualizer`. This is a hard requirement failure.

**External citations.** Style guide §5 requires ≥2 external citations to authority sites with real URLs. The draft has none.

---

### (c) Readability concerns

The Punnett square tables use `S` and `s` allele notation but are rendered with the heterozygous genotype as `Ss` throughout, which is correct. However, the "Super Soft Scale × Normal" section states "Every offspring is Ss — 100% Soft Scale." This is accurate only if the SSS parent is `SS` and the normal is `ss`. The draft does not establish this notation explicitly before using it, which will confuse readers new to incomplete dominant math.
