---
step: 16
slug: start-from-the-gecko-you-want
subject: Plan a pairing backward, from the gecko you want
preview: The reverse calculator lists the pairings that produce it, ranked by odds.
cta: Plan backward
path: /calculator/reverse
sources: src/pages/ReverseCalculator.jsx:34-42; src/pages/ReverseCalculator.jsx:176-184; src/pages/ReverseCalculator.jsx:264-295; src/lib/genetics/reverseSolver.js:163-170; src/lib/genetics/reverseSolver.js:357; src/lib/genetics/reverseSolver.js:466-471; src/lib/genetics/reverseSolver.js:531-543; src/lib/genetics/calculatorCatalog.js:586-592; scripts/lib/accepted-facts.mjs:34-35
---
You can plan a pairing backward: start from the gecko you want and work back
to the parents.

The reverse calculator works this way. Pick the gecko you are working toward,
and it lists the pairings that produce it, ranked by the odds per egg. Signed
in, it also scans your own collection for candidate pairs.

Some combos take two generations. Take an Axanthic Lilly White: it needs two
copies of the recessive Axanthic gene and one copy of Lilly White. Pair a
Lilly White that carries no Axanthic with a visual Axanthic, and every baby is
100% het Axanthic, with about half of them Lilly White. The visual Axanthic
Lilly Whites come in the next generation.

If no single pair you own can get there, but two generations can, the
calculator shows a route built from your own geckos, including which baby to
hold back.

Along the way, never pair two Lilly Whites. Super Lilly White is lethal:
embryos die in the egg or within days of hatching.

Open the reverse calculator and choose your goal.
