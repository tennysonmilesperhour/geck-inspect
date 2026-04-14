import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketplaceBuyPage from './MarketplaceBuy';
import MarketplaceSellPage from './MarketplaceSell';

export default function Marketplace() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Tabs defaultValue="buy" className="w-full">
        <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
          <div className="flex justify-center px-4 py-3">
            <TabsList className="grid grid-cols-2 w-full max-w-xs bg-slate-900 border border-slate-800 p-1 h-10">
              <TabsTrigger
                value="buy"
                className="text-slate-400 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-colors"
              >
                Buy Geckos
              </TabsTrigger>
              <TabsTrigger
                value="sell"
                className="text-slate-400 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-colors"
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