import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Crown,
  Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { parseMorphMarketCSV } from '@/lib/morphmarketSync';
import { readMorphMarketSource } from '@/lib/morphmarketListing';
import { importMorphMarketListing } from '@/lib/morphmarketListingApi';
import { Gecko } from '@/entities/all';
import { recordGeckoAdded } from '@/lib/activation';
import { resolveTier } from '@/lib/tierLimits';

/**
 * MorphMarket CSV sync panel, shown on the Seller Console for
 * Breeder and Enterprise tier users.
 *
 * Export: opens the full listing preservation workspace.
 *
 * Import: accepts a MorphMarket CSV export, parses it, previews
 *   the records, and creates gecko entries in Geck Inspect.
 */

export default function MorphMarketSync({ user, onImportComplete }) {
  const [importOpen, setImportOpen] = useState(false);
  const [importRecords, setImportRecords] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const [sourceRows, setSourceRows] = useState(null);
  const [sourceName, setSourceName] = useState('');
  const { toast } = useToast();

  // One plan resolver for the app: Stripe, app store, grandfathered and
  // admin plans all count (src/lib/tierLimits.js).
  const tier = resolveTier(user);
  const hasAccess = tier === 'breeder' || tier === 'enterprise';

  if (!hasAccess) {
    return (
      <Card>
        <CardContent className="p-4 md:p-6 text-center">
          <div className="space-y-3">
            <Crown className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm text-slate-300 font-semibold">MorphMarket Sync</p>
            <p className="text-xs text-slate-500">
              Import MorphMarket listings. CSV export is currently paused. Available on the Breeder tier.
            </p>
          </div>
          {/* inline-block so the top margin applies (a bare link is
              inline and ignores it, which left the button touching the
              paragraph above). */}
          <Link to={createPageUrl('Membership')} className="inline-block mt-4">
            <Button size="sm">
              Upgrade
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { toast({ title: 'Choose a file smaller than 10 MB', variant: 'destructive' }); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') return;

      const { records, warnings } = parseMorphMarketCSV(text);
      let fullSource = null;
      try { fullSource = readMorphMarketSource(text); }
      catch (error) { warnings.push(`Basic collection import only: ${error.message} Full listing details will not be saved.`); }
      if (fullSource) {
        const missingIds = fullSource.filter(r => r.fields.Category === 'Crested Geckos' && !r.fields.Animal_ID.trim());
        if (missingIds.length) {
          toast({ title: 'Set Animal IDs on MorphMarket first', description: 'Every imported animal needs its own seller Animal ID so repeat imports can match safely.', variant: 'destructive' });
          return;
        }
        warnings.push('All 33 listing fields will be saved privately. Existing exact Animal IDs keep their collection details. New animals are private.');
      }
      setSourceRows(fullSource);
      setSourceName(file.name);
      setImportRecords(records.map(record => ({ ...record, is_public: false })));
      setImportWarnings(warnings);
      setImportResult(null);
      setImportOpen(true);
    };
    reader.readAsText(file);
    // Reset the input so re-selecting the same file triggers onChange
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (importRecords.length === 0) return;
    setIsImporting(true);
    let created = 0;
    let failed = 0;
    let linked = 0;
    const errors = [];

    for (const record of importRecords) {
      try {
        if (sourceRows) {
          const source = sourceRows.find(r => r.fields.Animal_ID === record.gecko_id_code);
          if (!source) throw new Error('The Animal ID does not exactly match the source file.');
          const result = await importMorphMarketListing(record, source, sourceName, crypto.randomUUID());
          if (result.created) created++; else linked++;
        } else {
          await Gecko.create(record);
          created++;
        }
      } catch (error) {
        errors.push(`${record.name}: ${error.message}`);
        failed++;
      }
    }

    setImportResult({ created, linked, failed, errors });
    setIsImporting(false);
    if (created > 0) {
      recordGeckoAdded('morphmarket_sync', created);
      // Today, the Log tab, Field Mode and the Dashboard keep a copy of the
      // collection; this tells them it changed.
      window.dispatchEvent(new CustomEvent('geckos_changed', { detail: { action: 'imported' } }));
    }
    if (created > 0) {
      onImportComplete?.();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            MorphMarket Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            Import a complete MorphMarket Animal Records CSV to keep all 33 listing fields privately. Use the listing workspace to review updates against a fresh source file.
          </p>

          <Link to={createPageUrl('MorphMarketExport')} className="block">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 w-full"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Open listing workspace
            </Button>
          </Link>

          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-9"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Import CSV
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Import preview dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => !isImporting && setImportOpen(open)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              Import from MorphMarket CSV
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Review the parsed records before importing them into your collection.
            </DialogDescription>
          </DialogHeader>

          {importWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
              {importWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {w}
                </p>
              ))}
            </div>
          )}

          {importResult ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-lg font-semibold text-white">Import complete</p>
              <p className="text-sm text-slate-300">
                {importResult.created} gecko{importResult.created === 1 ? '' : 's'} created, {importResult.linked} existing listings matched
                {importResult.failed > 0 && (
                  <span className="text-amber-400">
                    , {importResult.failed} failed
                  </span>
                )}
              </p>
              {importResult.errors.map(message => <p key={message} className="text-sm text-amber-200">{message}</p>)}
              <Button
                onClick={() => setImportOpen(false)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              {importRecords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    {importRecords.length} record{importRecords.length === 1 ? '' : 's'} found
                  </p>
                  <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                    {importRecords.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-md bg-slate-900/60 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-slate-200 font-medium truncate">{r.name}</p>
                          <p className="text-slate-500 truncate">
                            {r.sex} · {r.morphs_traits || 'No traits'}{' '}
                            {r.asking_price ? `· $${r.asking_price}` : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            r.status === 'For Sale'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : r.status === 'Sold'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : 'bg-slate-700/40 text-slate-300 border-slate-600'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                  disabled={isImporting}
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={isImporting || importRecords.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1.5" />
                      Import {importRecords.length} gecko{importRecords.length === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
