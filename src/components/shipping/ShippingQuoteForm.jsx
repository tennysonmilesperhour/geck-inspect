import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Truck, DollarSign, Calendar, ShieldCheck, Thermometer } from 'lucide-react';
import { getShippingQuote } from '@/integrations/ShipZeros';

export default function ShippingQuoteForm({ onQuoteReceived }) {
  const [originZip, setOriginZip] = useState('');
  const [destZip, setDestZip] = useState('');
  const [animalCount, setAnimalCount] = useState('1');
  const [service, setService] = useState('overnight');
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);

  const handleGetQuote = async (e) => {
    e.preventDefault();
    if (!originZip || !destZip) return;

    setIsLoading(true);
    setError(null);
    setQuote(null);
    try {
      const result = await getShippingQuote({
        originZip,
        destZip,
        animalCount: parseInt(animalCount, 10) || 1,
        service,
      });
      setQuote(result);
      onQuoteReceived?.(result);
    } catch (err) {
      setError(err.message || 'Failed to get quote');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleGetQuote} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="origin-zip" className="text-slate-300">
              Origin ZIP code
            </Label>
            <Input
              id="origin-zip"
              placeholder="90210"
              value={originZip}
              onChange={(e) => setOriginZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              className="bg-slate-950 border-slate-700 text-slate-100"
              maxLength={5}
            />
          </div>
          <div>
            <Label htmlFor="dest-zip" className="text-slate-300">
              Destination ZIP code
            </Label>
            <Input
              id="dest-zip"
              placeholder="10001"
              value={destZip}
              onChange={(e) => setDestZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              className="bg-slate-950 border-slate-700 text-slate-100"
              maxLength={5}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="animal-count" className="text-slate-300">
              Number of animals
            </Label>
            <Select value={animalCount} onValueChange={setAnimalCount}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} gecko{n > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="service" className="text-slate-300">
              Service level
            </Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectItem value="overnight">Overnight (recommended)</SelectItem>
                <SelectItem value="express">Express (2-day)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading || originZip.length < 5 || destZip.length < 5}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Getting quote...
            </>
          ) : (
            <>
              <Truck className="w-4 h-4 mr-2" /> Get shipping quote
            </>
          )}
        </Button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {quote && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-emerald-300 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Shipping quote
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Service</span>
              <span className="text-white font-semibold">{quote.service}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Carrier</span>
              <span className="text-white font-semibold">{quote.carrier}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Price</span>
              <span className="text-2xl font-bold text-emerald-300">
                ${quote.price.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Est. delivery
              </span>
              <span className="text-white font-semibold">{quote.estimatedDelivery}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-3 text-xs">
              {quote.includesInsurance && (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3 h-3" /> Insured
                </span>
              )}
              {quote.includesHeatPack && (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <Thermometer className="w-3 h-3" /> Heat pack included
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
