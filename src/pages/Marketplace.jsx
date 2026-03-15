import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketplaceBuyPage from './MarketplaceBuy';
import MarketplaceSellPage from './MarketplaceSell';

export default function Marketplace() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Tabs defaultValue="buy" className="w-full">
        <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-800">
              <TabsTrigger value="buy">Buy Geckos</TabsTrigger>
              <TabsTrigger value="sell">Sell Geckos</TabsTrigger>
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