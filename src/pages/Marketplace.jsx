import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Seo from '@/components/seo/Seo';
import { ORG_ID, SITE_URL } from '@/lib/organization-schema';
import MarketplaceBuyPage from './MarketplaceBuy';
import MarketplaceSellPage from './MarketplaceSell';

// CollectionPage schema for the marketplace landing, declares this URL
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
  // Tracked here only so the tab strip can match the width of the page
  // below it (Buy is max-w-7xl, the Seller Console max-w-6xl).
  const [tab, setTab] = useState('buy');

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
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        {/* Same side gutter (px-4 md:px-8) and max width as the embedded
            page, so the tab bar lines up with the page content below. */}
        <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 md:px-8 py-3">
          <div className={`${tab === 'sell' ? 'max-w-6xl' : 'max-w-7xl'} mx-auto`}>
            <TabsList>
              <TabsTrigger value="buy">Buy Geckos</TabsTrigger>
              <TabsTrigger value="sell">Sell Geckos</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* The embedded pages are also standalone routes, so their own
            wrapper is min-h-screen. Under this strip that added a full
            extra viewport of empty scroll; this wrapper already fills the
            screen, so the embedded page's minimum height is dropped. */}
        <TabsContent value="buy" className="m-0 [&>.min-h-screen]:min-h-0">
          <MarketplaceBuyPage />
        </TabsContent>

        <TabsContent value="sell" className="m-0 [&>.min-h-screen]:min-h-0">
          <MarketplaceSellPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}