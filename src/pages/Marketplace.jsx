import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Seo from '@/components/seo/Seo';
import { ORG_ID, SITE_URL } from '@/lib/organization-schema';
import MarketplaceBuyPage from './MarketplaceBuy';
import MarketplaceSellPage from './MarketplaceSell';

// CollectionPage schema for the marketplace landing ,  declares this URL
// as a curated collection of crested gecko listings so AI assistants can
// answer "where can I buy a crested gecko on Geck Inspect" with the
// canonical entry point rather than an inner sub-tab URL.
const MARKETPLACE_JSON_LD = [
  {
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/Marketplace#collection`,
    name: 'Crested Gecko Marketplace',
    url: `${SITE_URL}/Marketplace`,
    description:
      'Buy and sell crested geckos through Geck Inspect. Browse listings from breeders worldwide, filter by morph, sex, age, and price, and message sellers directly.',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': ORG_ID },
    about: {
      '@type': 'Thing',
      name: 'Crested gecko',
      alternateName: 'Correlophus ciliatus',
    },
    mainEntity: {
      '@type': 'ItemList',
      name: 'Marketplace sections',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Buy Geckos', url: `${SITE_URL}/MarketplaceBuy` },
        { '@type': 'ListItem', position: 2, name: 'Sell Geckos', url: `${SITE_URL}/MarketplaceSell` },
      ],
    },
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Marketplace', item: `${SITE_URL}/Marketplace` },
    ],
  },
];

export default function Marketplace() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Seo
        title="Crested Gecko Marketplace"
        description="Buy and sell crested geckos on Geck Inspect. Browse listings from breeders worldwide, filter by morph, sex, age, and price, and message sellers directly."
        path="/Marketplace"
        imageAlt="Geck Inspect crested gecko marketplace"
        keywords={[
          'crested gecko marketplace',
          'buy crested gecko',
          'sell crested gecko',
          'gecko classifieds',
          'crestie for sale',
        ]}
        jsonLd={MARKETPLACE_JSON_LD}
      />
      <Tabs defaultValue="buy" className="w-full">
        <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
          <div className="flex justify-center px-4 py-3">
            <TabsList className="flex w-full max-w-xs bg-slate-950 border border-slate-700 rounded-md p-1.5 gap-1">
              <TabsTrigger
                value="buy"
                className="flex-1 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors"
              >
                Buy Geckos
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                className="flex-1 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors"
              >
                Sell Geckos
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="buy" className="m-0">
          <MarketplaceBuyPage />
        </TabsContent>

        <TabsContent value="sell" className="m-0">
          <MarketplaceSellPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}