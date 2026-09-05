# Custom collector-card market scan

Date: 5 September 2026

## What current sellers offer

- [MBZ Designs](https://www.mbz-designs.com/products/holographic-trading-cards-pet-edition-dogs-cats) sells a $19.99 holographic PVC pet card with personality stats and front or back layout options.
- [ForgeMyCard on Etsy](https://www.etsy.com/ie/listing/4501520463/custom-personalized-pet-trading-card) lets buyers choose the name, photo, stats, abilities, wording, color family, and finish. It offers glossy plus several foil patterns, includes a sleeve and hard case, and sends a digital proof before printing.
- [Mochi Gardens](https://mochigardens.com/products/custom-pet-trading-card) uses a questionnaire, an approval step, digital delivery, physical products, and holographic, glitter, or clean treatments.
- [Moment Deck](https://momentdeck.com/products/custom-trading-card-battle-for-pet-lover) reduces the purchase flow to three steps: choose a template, personalize it with a live preview, then order the printed card.
- [This Etsy pet-card listing](https://www.etsy.com/listing/4311965658/custom-pokemon-pet-card-personalized) shows the common breadth of options: names, a color or element family, two moves, a personality fact, multiple finishes, a sleeve, and an optional stand.

## Patterns worth adapting

1. Keep template choice small and visual.
2. Let the buyer edit the name, stats, signature moves, and color family.
3. Show every change in a live preview.
4. Offer a short finish list with obvious visual differences.
5. Save the approved preview as the production reference.
6. Explain the order flow before the form begins.

## Geck Inspect implementation

The builder uses those product patterns without copying protected card names, logos, characters, frames, or exact trade dress. The collector-card format now uses Geck Inspect terms such as affinity, power score, life stage, signature moves, and edition details. Stored values remain backward compatible with older carts and orders.

The current physical choices are Clean gloss, Prism foil, and Soft matte. All three are saved with the cart line. Collector-card previews show the selected surface treatment.

## Guardrail

Competitor listings are evidence of buyer expectations, not evidence that a design is safe to copy. Pokémon's published terms limit its content to personal, noncommercial use and prohibit commercial use that suggests association or creates confusion. Geck Inspect should keep its own brand, vocabulary, iconography, layout proportions, and artwork system.
