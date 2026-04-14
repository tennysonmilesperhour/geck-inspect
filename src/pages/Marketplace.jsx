import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketplaceBuyPage from './MarketplaceBuy';
import MarketplaceSellPage from './MarketplaceSell';

export default function Marketplace() {
  return (
    <div className="min-h-screen bg-slate-950">
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