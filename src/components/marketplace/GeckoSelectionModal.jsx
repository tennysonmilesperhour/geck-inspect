import { useState, useEffect } from 'react';
import { Gecko } from '@/entities/all';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Search, Check } from 'lucide-react';

export default function GeckoSelectionModal({ mode, onClose, onAddGeckos, userEmail }) {
  const [geckos, setGeckos] = useState([]);
  const [filteredGeckos, setFilteredGeckos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGeckos, setSelectedGeckos] = useState(new Set());
  const [missingPrices, setMissingPrices] = useState({});
  const [step, setStep] = useState('select'); // 'select' or 'fillMissing'

  useEffect(() => {
    const fetchGeckos = async () => {
      try {
        let query = { created_by: userEmail, archived: false };
        
        if (mode === 'listings') {
          query.status = 'For Sale';
          query.is_public = true;
        }

        const allGeckos = await Gecko.filter(query);
        setGeckos(allGeckos);
        setFilteredGeckos(allGeckos);
      } catch (error) {
        console.error('Failed to fetch geckos:', error);
        setGeckos([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGeckos();
  }, [mode, userEmail]);

  const handleSearch = (term) => {
    setSearchTerm(term);
    const lower = term.toLowerCase();
    setFilteredGeckos(
      geckos.filter(g => 
        g.name?.toLowerCase().includes(lower) ||
        g.morphs_traits?.toLowerCase().includes(lower)
      )
    );
  };

  const toggleGecko = (geckoId) => {
    const newSet = new Set(selectedGeckos);
    if (newSet.has(geckoId)) {
      newSet.delete(geckoId);
      const pricesCopy = { ...missingPrices };
      delete pricesCopy[geckoId];
      setMissingPrices(pricesCopy);
    } else {
      newSet.add(geckoId);
    }
    setSelectedGeckos(newSet);
  };

  const handleProceedToMissing = () => {
    const missing = {};
    selectedGeckos.forEach(geckoId => {
      const gecko = geckos.find(g => g.id === geckoId);
      if (!gecko?.asking_price) {
        missing[geckoId] = '';
      }
    });

    if (Object.keys(missing).length > 0) {
      setMissingPrices(missing);
      setStep('fillMissing');
    } else {
      handleAddSelected();
    }
  };

  const handleAddSelected = () => {
    const geckoList = Array.from(selectedGeckos).map(geckoId => {
      const gecko = geckos.find(g => g.id === geckoId);
      return {
        ...gecko,
        asking_price: missingPrices[geckoId] || gecko.asking_price
      };
    });

    onAddGeckos(geckoList);
    onClose();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-2xl w-full">
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'fillMissing') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-100">Enter Missing Prices</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-slate-400 text-sm mb-6">
            The following geckos don't have a sale price. Please enter the price for each:
          </p>

          <div className="space-y-4 mb-6">
            {Object.entries(missingPrices).map(([geckoId, price]) => {
              const gecko = geckos.find(g => g.id === geckoId);
              return (
                <div key={geckoId} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {gecko?.image_urls?.[0] && (
                      <img
                        src={gecko.image_urls[0]}
                        alt={gecko.name}
                        className="w-12 h-12 rounded object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-slate-100">{gecko?.name}</p>
                      <p className="text-xs text-slate-500">{gecko?.morphs_traits}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Sale Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter price"
                      value={price}
                      onChange={(e) => setMissingPrices(prev => ({ ...prev, [geckoId]: e.target.value }))}
                      className="bg-slate-700 border-slate-600 text-slate-100 h-9 text-sm mt-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep('select')}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Back
            </Button>
            <Button
              onClick={handleAddSelected}
              className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              Add {selectedGeckos.size} {selectedGeckos.size === 1 ? 'Gecko' : 'Geckos'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Select Geckos {mode === 'listings' ? 'from Listings' : 'from Collection'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {selectedGeckos.size} selected
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or morph..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-6">
          {filteredGeckos.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>{searchTerm ? 'No geckos match your search.' : 'No geckos available.'}</p>
            </div>
          ) : (
            filteredGeckos.map(gecko => (
              <button
                key={gecko.id}
                onClick={() => toggleGecko(gecko.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  selectedGeckos.has(gecko.id)
                    ? 'bg-emerald-900/40 border-emerald-700/50'
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                }`}
              >
                {gecko.image_urls?.[0] && (
                  <img
                    src={gecko.image_urls[0]}
                    alt={gecko.name}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-slate-100">{gecko.name}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{gecko.morphs_traits}</span>
                    {gecko.asking_price && (
                      <span className="text-emerald-400 font-semibold">
                        ${gecko.asking_price}
                      </span>
                    )}
                  </div>
                </div>
                {selectedGeckos.has(gecko.id) && (
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleProceedToMissing}
            disabled={selectedGeckos.size === 0}
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 mr-2" />
            Add {selectedGeckos.size} {selectedGeckos.size === 1 ? 'Gecko' : 'Geckos'}
          </Button>
        </div>
      </div>
    </div>
  );
}