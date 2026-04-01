import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dna, Grid2X2, Layers, TrendingUp, ShieldCheck, ChevronDown, ChevronUp, ArrowUp, ChevronRight, ChevronLeft, Search } from 'lucide-react';

// ── Callout box ──────────────────────────────────────────────────────────────
function Callout({ items }) {
  return (
    <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-4 my-4 space-y-1">
      {items.map((item, i) => (
        <p key={i} className="text-emerald-400 text-sm font-medium">→ {item}</p>
      ))}
    </div>
  );
}

// ── Subsection collapsible ────────────────────────────────────────────────────
function Subsection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left">
        <div className="flex items-center justify-between py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">
          <h3 className="text-emerald-400 font-semibold text-base">{title}</h3>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pt-3 pb-4 space-y-2 bg-slate-800/50 rounded-b-lg">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-slate-300 text-sm leading-relaxed">
          <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Content data ──────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'foundations',
    title: 'Foundations of Genetics',
    level: 'Beginner',
    icon: Dna,
    intro: 'Before diving into crested gecko morphs, you need to understand the basic language of genetics. These concepts apply to all living things — including your geckos.',
    subsections: [
      {
        title: 'What is a Gene?',
        content: (
          <BulletList items={[
            'Every living organism carries a set of instructions called genes — segments of DNA that determine physical traits like color, pattern, eye shape, and size.',
            'In crested geckos, genes influence melanin production, pattern layout, and whether structural traits like Lilly White or Axanthic coloration appear.',
            'Each gecko inherits two copies of every gene — one from the mother, one from the father. These two copies are called alleles.',
          ]} />
        )
      },
      {
        title: 'Alleles: The Two Copies',
        content: (
          <BulletList items={[
            'An allele is a version of a gene. Since a gecko gets one copy from each parent, it always has two alleles per gene.',
            'Identical alleles (homozygous): written AA or aa. Different alleles (heterozygous): written Aa.',
            'Whether a trait shows up visually depends on which alleles the gecko carries and how they interact.',
          ]} />
        )
      },
      {
        title: 'Dominant vs. Recessive',
        content: (
          <>
            <BulletList items={[
              'A dominant allele expresses itself even when only one copy is present.',
              'A recessive allele only expresses itself when two copies are present — one from each parent. With only one copy, the trait is hidden but can be passed to offspring. This is called being "het" (heterozygous) for that trait.',
              'Example: Axanthic is recessive. Two copies (aa) are required for the grey/colorless appearance. One copy (Aa) looks completely normal — no visual indication of het status.',
            ]} />
            <Callout items={[
              'Axanthic het status is invisible — only documented lineage confirms it',
              'Visual assessment of het status is never valid',
              'Het animals can produce visual offspring when paired with another het or visual',
            ]} />
          </>
        )
      },
      {
        title: 'Codominant & Incomplete Dominant',
        content: (
          <BulletList items={[
            'Codominant: both alleles express simultaneously. Lilly White follows codominant-like inheritance — one copy shows the trait, two copies (super LW) is believed to be lethal or severely compromised.',
            'Incomplete dominant: heterozygous animals show a partial version; homozygous shows full expression. Seen in some color and pattern traits.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'punnett',
    title: 'Punnett Squares & Probability',
    level: 'Beginner',
    icon: Grid2X2,
    intro: 'A Punnett square predicts possible genetic outcomes of a pairing. It shows probabilities across many offspring — not guarantees for individual clutches.',
    subsections: [
      {
        title: 'How to Read a Punnett Square',
        content: (
          <BulletList items={[
            'A 2x2 grid — one parent\'s alleles across the top, the other\'s down the side.',
            'Each of the four boxes represents a possible offspring combination at 25% probability.',
            'The same combination in multiple boxes increases probability: two boxes = 50%, three = 75%.',
            'Punnett squares show probability, not certainty. 25% chance of a visual does not guarantee one per 4 eggs.',
          ]} />
        )
      },
      {
        title: 'Het x Het (Aa x Aa)',
        content: (
          <>
            <BulletList items={[
              'When both parents carry one copy of a recessive but look normal (Aa x Aa):',
              '25% AA — does not carry the gene at all',
              '50% Aa — het, looks normal, carries the gene invisibly',
              '25% aa — visual (displays the trait)',
              'Of visually normal offspring: 2 out of 3 statistically carry the gene.',
            ]} />
            <Callout items={[
              'Aa x Aa = 25% visual, 50% het, 25% non-carrier',
              'This is the standard pairing to produce visual recessives',
              'Requires patience — multiple clutches needed for reliable results',
            ]} />
          </>
        )
      },
      {
        title: 'Het x Visual (Aa x aa)',
        content: (
          <BulletList items={[
            '50% Aa — het offspring, looks normal, carries the gene',
            '50% aa — visual offspring',
            'More efficient than het x het for producing visuals. The tradeoff is cost — visual animals from quality lines are more expensive.',
          ]} />
        )
      },
      {
        title: 'Visual x Non-Carrier (aa x AA)',
        content: (
          <BulletList items={[
            '100% of offspring are het (Aa) — none will be visual, but all carry the gene.',
            'This is how breeders introduce a recessive into a new bloodline without losing other desirable traits. Hets can be back-paired in the next generation.',
          ]} />
        )
      },
      {
        title: 'Multiple Traits',
        content: (
          <BulletList items={[
            'Tracking two independent recessives simultaneously: probability compounds multiplicatively.',
            'Double het x double het = 6.25% chance per offspring of being visual for both traits.',
            'Each additional recessive cuts the odds by ~75% again.',
            'Use the Genetic Calculator in this app for multi-trait calculations.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'morphs',
    title: 'Crested Gecko Morphs & Traits',
    level: 'Intermediate',
    icon: Layers,
    intro: 'Crested gecko genetics are more complex than many other reptiles because most traits are polygenic — controlled by many genes working together, not a single switch.',
    subsections: [
      {
        title: 'Morph vs. Trait Distinction',
        content: (
          <BulletList items={[
            'A morph is a genetically distinct variant with a known, predictable inheritance pattern (e.g. Lilly White, Axanthic). These have been proven through controlled breeding.',
            'A trait (or "line") refers to phenotypic characteristics whose precise genetics aren\'t fully mapped — most crested gecko "traits" fall here.',
            'Claiming an animal "produces" a trait when genetics aren\'t proven is misleading to buyers.',
          ]} />
        )
      },
      {
        title: 'Base Colors (polygenic)',
        content: (
          <BulletList items={[
            'Base color is controlled by many genes — you cannot predict exact color from parents the way you predict a simple recessive.',
            'Common base colors: Buckskin (warm tan/brown), Olive (muted green-brown), Red (vibrant orange-red), Yellow (lemon to golden), Chocolate/Dark Brown, Cream/Blonde.',
            'Two vibrant red parents will statistically produce more red offspring — but there are no guarantees. Some offspring will exceed both parents; others will fall short.',
          ]} />
        )
      },
      {
        title: 'Pattern Types (polygenic)',
        content: (
          <BulletList items={[
            'Patternless — solid base color, no dorsal pattern',
            'Dalmatian — spots across body, sparse to extreme',
            'Bicolor / Tricolor — two or three distinct color zones',
            'Harlequin — high-contrast lateral extension',
            'Extreme Harlequin — near-full pattern coverage',
            'Tiger — lateral banding/striping',
            'Pinstripe — raised cream dorsal stripe (full or partial)',
          ]} />
        )
      },
      {
        title: 'Lilly White (LW)',
        content: (
          <>
            <BulletList items={[
              'Characterized by areas of pure white or pale cream distinctly different from normal pale markings.',
              'Codominant-like inheritance: one copy = visual LW. Two copies (super LW) believed to be non-viable — avoid intentionally producing them.',
              'Not all "white" on a crested gecko is Lilly White. True LW requires documented lineage, not visual assessment alone.',
            ]} />
            <Callout items={[
              'One copy (LW het): visual Lilly White trait present',
              'Two copies (super LW): extreme expression, likely non-viable',
              'Zero copies: normal appearance, does not carry the gene',
            ]} />
          </>
        )
      },
      {
        title: 'Axanthic',
        content: (
          <BulletList items={[
            'Lacks xanthophores — pigment cells responsible for yellow and red. Appears in shades of grey, white, and black regardless of underlying color genetics.',
            'Recessive — two copies required for visual expression.',
            'One of the cleanest recessives in the hobby. Visual axanthics will never show orange or red, even when fired up.',
            'Het axanthics look completely normal. Only documented lineage or offspring results confirm het status.',
          ]} />
        )
      },
      {
        title: 'Phantom',
        content: (
          <BulletList items={[
            'Newer recessive morph. Characterized by reduced pattern expression and darker, muted overall appearance. Visual phantoms often appear nearly patternless.',
            'Still being studied — less consensus on full genetic interaction with other traits.',
            'Exercise caution when purchasing claimed het phantoms from unproven lines.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'polygenic',
    title: 'Polygenic Traits & Selective Breeding',
    level: 'Advanced',
    icon: TrendingUp,
    intro: 'Most of what makes crested geckos visually stunning is not controlled by a single gene. Understanding polygenic inheritance separates a hobbyist breeder from a serious one.',
    subsections: [
      {
        title: 'What Makes a Trait Polygenic?',
        content: (
          <BulletList items={[
            'A polygenic trait is controlled by many genes, each contributing a small additive effect to the final outcome.',
            'Unlike simple Mendelian traits, polygenic traits produce a continuous spectrum — why gecko coloration ranges smoothly from pale to vibrant rather than jumping between two states.',
            'You cannot predict polygenic outcomes with a Punnett square. You can only influence them through consistent selective breeding over multiple generations.',
          ]} />
        )
      },
      {
        title: 'Breeding Value',
        content: (
          <BulletList items={[
            'Two geckos can look identical but have very different breeding values — the genetic potential an animal contributes to offspring beyond what it displays itself.',
            'Assess breeding value by tracking offspring across multiple pairings with different partners. Consistent high-quality results demonstrate high breeding value.',
            '"Proven producers" command premium prices because their breeding value has been demonstrated through results, not assumed from appearance.',
          ]} />
        )
      },
      {
        title: 'Selecting for Polygenic Traits',
        content: (
          <BulletList items={[
            'Consistent selection pressure: every generation, keep only animals that best express target traits.',
            'High sample sizes: evaluate many offspring before drawing conclusions. Small clutches give limited information.',
            'Long time horizons: meaningful genetic progress typically takes 5-10 generations of consistent selection.',
            'Avoid tight inbreeding: maintains genetic diversity and reduces risk of harmful recessives.',
          ]} />
        )
      },
      {
        title: 'Epistasis: Gene Interaction',
        content: (
          <BulletList items={[
            'Epistasis occurs when one gene masks or modifies expression of another.',
            'An axanthic gecko carries normal red/yellow color genes that are masked. Breed that axanthic to a high-red gecko — the het offspring show normal, potentially vibrant coloration because color genes are expressed. Only homozygous axanthic offspring show grey again.',
            'Background genetics — all other genes interacting with the trait you\'re selecting for — can dramatically affect expression. The same morph can look dramatically different from different breeding programs.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'proven',
    title: 'Proven vs. Unproven Genetics',
    level: 'Advanced',
    icon: ShieldCheck,
    intro: 'The word "proven" is one of the most important — and most abused — terms in reptile breeding. Understanding what it actually means protects your breeding program and your integrity.',
    subsections: [
      {
        title: 'What "Proven" Actually Means',
        content: (
          <BulletList items={[
            'A proven genetic claim means the inheritance pattern has been demonstrated through controlled, documented breeding outcomes — not assumed from appearance.',
            'To prove a recessive: a visual must be produced from two claimed hets, OR a visual must produce hets that then produce visuals when paired together.',
            'One visual offspring from one pairing is suggestive. Multiple visuals across multiple pairings is proof.',
            'Appearance alone proves nothing. Visual assessment of het status is not valid.',
          ]} />
        )
      },
      {
        title: 'Possible Het vs. 100% Het',
        content: (
          <>
            <BulletList items={[
              '100% het: parentage guarantees one copy. Example: offspring from visual x non-carrier.',
              '66% possible het: from het x het normal-looking offspring — 2 of 3 possible outcomes statistically carry the gene.',
              '50% possible het: one parent confirmed het, other unknown.',
              'Possible hets have real value but must be honestly represented — never as guaranteed hets.',
            ]} />
            <Callout items={[
              '100% het: parentage-documented, price accordingly',
              '66% pos het: from het x het normal-looking offspring',
              '50% pos het: one parent confirmed het only',
              'Visual assessment: NEVER valid for het determination',
            ]} />
          </>
        )
      },
      {
        title: 'Visual Confirmation Bias',
        content: (
          <BulletList items={[
            'The most common mistake: confirming genetic claims based on how an animal looks.',
            'Het status for recessives: a "normal" looking gecko cannot be visually assessed. Period.',
            'Lilly White: many geckos show pale markings superficially resembling LW — only lineage confirms it.',
            'Axanthic hets: grey coloring or faded appearance is not evidence of axanthic het status.',
            'Purchasing animals with unverified genetic claims and breeding them into your lines contaminates your documentation.',
          ]} />
        )
      },
      {
        title: 'Documentation Standards',
        content: (
          <BulletList items={[
            'Document for every breeding: sire and dam identity (name, ID code, photo), their known genetics with proven vs possible het status, clutch dates and egg outcomes, offspring identity and photos.',
            'When selling: provide both parents\' genetics and an honest description of proven vs possible het status.',
            'Breeders who maintain this standard build reputations that allow fair pricing with confidence.',
          ]} />
        )
      },
      {
        title: 'When Genetics Are In Progress',
        content: (
          <BulletList items={[
            'Be transparent: "I believe this is heritable based on my observations, but it hasn\'t been proven" is an honest and respectable position.',
            'Don\'t overclaim pricing — unproven traits should not command the same price as established morphs.',
            'Contribute to the community by documenting and sharing findings openly.',
            'Support independent verification — the strongest proof comes when multiple unrelated breeders replicate results.',
          ]} />
        )
      },
    ]
  },
];

const GLOSSARY = [
  { term: 'Allele', def: 'A version of a gene. Every gecko has two alleles per gene — one from each parent.' },
  { term: 'Homozygous', def: 'Both alleles are identical (AA or aa).' },
  { term: 'Heterozygous (Het)', def: 'Alleles are different (Aa). Carries one copy of a recessive gene without showing it.' },
  { term: 'Dominant', def: 'Trait expresses with only one copy of the allele present.' },
  { term: 'Recessive', def: 'Trait only expresses when two copies are present (one from each parent).' },
  { term: 'Codominant', def: 'Both alleles express simultaneously; neither dominates. Lilly White follows this pattern.' },
  { term: '100% Het', def: 'Parentage guarantees the animal carries one copy of the recessive.' },
  { term: 'Possible Het (Pos Het)', def: 'May carry the gene — probability stated as 50% or 66% based on parentage.' },
  { term: 'Visual', def: 'The animal displays the recessive trait — has two copies (homozygous).' },
  { term: 'Polygenic', def: 'Trait controlled by many genes with additive effects. Cannot be Punnett-squared.' },
  { term: 'Epistasis', def: 'One gene masks or modifies the expression of another gene.' },
  { term: 'Proven', def: 'Inheritance pattern demonstrated through documented, controlled breeding results.' },
  { term: 'Breeding Value', def: 'Genetic potential an animal contributes to offspring beyond its own display.' },
  { term: 'Lilly White (LW)', def: 'Codominant morph with white/cream areas. One copy = visual LW. Two copies = likely non-viable.' },
  { term: 'Axanthic', def: 'Recessive morph lacking yellow/red pigment. Appears grey/white. Two copies required to show.' },
  { term: 'Phantom', def: 'Newer recessive morph that reduces pattern expression. Still being proven in the hobby.' },
  { term: 'Punnett Square', def: 'A 2x2 grid tool for predicting offspring genetic probabilities from a pairing.' },
  { term: 'Selective Breeding', def: 'Consistently pairing animals displaying desired traits across multiple generations.' },
];

const LEVEL_COLORS = {
  Beginner: 'bg-emerald-700 text-emerald-100',
  Intermediate: 'bg-blue-700 text-blue-100',
  Advanced: 'bg-red-900 text-red-200',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GeneticsGuide() {
  const [levelFilter, setLevelFilter] = useState('All');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState('');
  const sectionRefs = useRef({});

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const filteredSections = levelFilter === 'All'
    ? SECTIONS
    : SECTIONS.filter(s => s.level === levelFilter);

  const filteredGlossary = GLOSSARY.filter(g =>
    g.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    g.def.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Dna className="w-8 h-8 text-emerald-400" />
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100">Crested Gecko Genetics Guide</h1>
        </div>
        <p className="text-slate-400 mb-6">An interactive educational reference for understanding crested gecko genetics, morphs, and selective breeding.</p>
        <div className="flex flex-wrap gap-2">
          {['All', 'Beginner', 'Intermediate', 'Advanced'].map(level => (
            <Button
              key={level}
              variant={levelFilter === level ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLevelFilter(level)}
              className={levelFilter === level ? '' : 'border-slate-600 text-slate-300'}
            >
              {level}
            </Button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto">
        <Tabs defaultValue="guide">
          <TabsList className="bg-slate-800 mb-6">
            <TabsTrigger value="guide" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Guide</TabsTrigger>
            <TabsTrigger value="glossary" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Glossary</TabsTrigger>
          </TabsList>

          {/* Guide Tab */}
          <TabsContent value="guide">
            <div className="flex gap-6">
              {/* Sidebar */}
              <div className="hidden lg:block w-56 flex-shrink-0">
                <div className="sticky top-4 bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">Sections</p>
                  {filteredSections.map(section => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className="w-full text-left px-2 py-2 rounded text-sm text-slate-300 hover:bg-slate-800 hover:text-emerald-400 transition-colors"
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 space-y-10 min-w-0">
                {filteredSections.map((section, sectionIdx) => {
                  const Icon = section.icon;
                  const prevSection = filteredSections[sectionIdx - 1];
                  const nextSection = filteredSections[sectionIdx + 1];
                  return (
                    <div key={section.id} ref={el => sectionRefs.current[section.id] = el}>
                      {/* Section header card */}
                      <Card className="bg-slate-900 border-slate-700 mb-4">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                            <h2 className="text-xl md:text-2xl font-bold text-slate-100">{section.title}</h2>
                            <Badge className={`ml-auto text-xs ${LEVEL_COLORS[section.level]}`}>{section.level}</Badge>
                          </div>
                          <p className="text-slate-400 italic text-sm leading-relaxed">{section.intro}</p>
                        </CardHeader>
                      </Card>

                      {/* Subsections */}
                      <div className="space-y-3">
                        {section.subsections.map(sub => (
                          <Subsection key={sub.title} title={sub.title}>
                            {sub.content}
                          </Subsection>
                        ))}
                      </div>

                      {/* Prev / Next */}
                      <div className="flex justify-between mt-6 pt-4 border-t border-slate-800">
                        {prevSection ? (
                          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => scrollToSection(prevSection.id)}>
                            <ChevronLeft className="w-4 h-4 mr-1" /> {prevSection.title}
                          </Button>
                        ) : <div />}
                        {nextSection ? (
                          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => scrollToSection(nextSection.id)}>
                            {nextSection.title} <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        ) : <div />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Glossary Tab */}
          <TabsContent value="glossary">
            <div className="max-w-3xl">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search glossary..."
                  value={glossarySearch}
                  onChange={e => setGlossarySearch(e.target.value)}
                  className="pl-9 bg-slate-800 border-slate-600 text-slate-100"
                />
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-700">
                <div className="grid grid-cols-[180px_1fr] bg-emerald-900/60 px-4 py-2">
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Term</span>
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Definition</span>
                </div>
                {filteredGlossary.map((row, i) => (
                  <div key={row.term} className={`grid grid-cols-[180px_1fr] px-4 py-3 gap-4 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800'}`}>
                    <span className="text-emerald-400 font-semibold text-sm">{row.term}</span>
                    <span className="text-slate-300 text-sm leading-relaxed">{row.def}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Back to Top */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-3 shadow-lg transition-all"
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}