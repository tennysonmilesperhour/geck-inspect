/**
 * GeckoPassport — generate and display a verifiable digital passport.
 *
 * Two modes:
 *   1. Generator: renders a "Generate Passport" button that produces
 *      a shareable URL + visual passport card.
 *   2. Viewer: renders the passport from a token (on the /passport route).
 *
 * Usage (generator):
 *   <GeckoPassportGenerator gecko={gecko} owner={user} weightRecords={records} />
 *
 * Usage (viewer):
 *   <GeckoPassportViewer token={tokenFromUrl} />
 */
import { useState } from 'react';
import { generatePassportToken, decodePassportToken } from '@/hooks/useGeckoPassport';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Copy, Check, AlertTriangle, Dna, Scale, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function GeckoPassportGenerator({ gecko, owner, weightRecords, parents }) {
  const [passportUrl, setPassportUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const { token } = generatePassportToken(gecko, { owner, weightRecords, parents });
    const url = `${window.location.origin}/passport?data=${encodeURIComponent(token)}`;
    setPassportUrl(url);
  };

  const handleCopy = async () => {
    if (!passportUrl) return;
    try {
      await navigator.clipboard.writeText(passportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = passportUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        className="border-purple-600/40 text-purple-300 hover:bg-purple-900/30"
      >
        <ShieldCheck className="w-4 h-4 mr-1.5" />
        Generate Gecko Passport
      </Button>

      {passportUrl && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
          <p className="text-xs text-slate-400">Shareable verification link:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={passportUrl}
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-emerald-300 font-mono truncate"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="shrink-0 text-slate-300"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Anyone with this link can verify this gecko's provenance on Geck Inspect.
          </p>
        </div>
      )}
    </div>
  );
}

export function GeckoPassportViewer({ token }) {
  if (!token) {
    return (
      <Card className="bg-slate-900 border-slate-700 max-w-lg mx-auto">
        <CardContent className="py-12 text-center text-slate-500">
          No passport token provided.
        </CardContent>
      </Card>
    );
  }

  const result = decodePassportToken(token);

  if (result.error) {
    return (
      <Card className="bg-red-950/50 border-red-700 max-w-lg mx-auto">
        <CardContent className="py-8 text-center space-y-3">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-red-300">Verification Failed</h2>
          <p className="text-red-400 text-sm">
            {result.error === 'tampered'
              ? 'This passport has been modified and cannot be trusted.'
              : 'This passport link is invalid or corrupted.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const p = result.payload;

  return (
    <Card className="bg-slate-900 border-emerald-700/50 max-w-lg mx-auto overflow-hidden">
      {/* Header band */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 px-6 py-4 flex items-center gap-3">
        <ShieldCheck className="w-8 h-8 text-emerald-300" />
        <div>
          <h2 className="text-lg font-bold text-white">Verified Gecko Passport</h2>
          <p className="text-xs text-emerald-300/70">Issued by Geck Inspect</p>
        </div>
        <Badge className="ml-auto bg-emerald-500/20 text-emerald-200 border-emerald-400/40">
          Authentic
        </Badge>
      </div>

      <CardContent className="p-6 space-y-5">
        {/* Identity */}
        <div>
          <h3 className="text-2xl font-bold text-white">{p.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            {p.sex && (
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                {p.sex === 'Male' ? '\u2642' : p.sex === 'Female' ? '\u2640' : ''} {p.sex}
              </Badge>
            )}
            {p.hatch && (
              <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                <Calendar className="w-3 h-3 mr-1" />
                Hatched {p.hatch}
              </Badge>
            )}
          </div>
        </div>

        {/* Morphs */}
        {p.morph?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Dna className="w-3 h-3" /> Morph Classification
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {p.morph.map(m => (
                <Badge key={m} className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-xs">
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Lineage */}
        {p.parents && (p.parents.sire || p.parents.dam) && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lineage</h4>
            <div className="grid grid-cols-2 gap-3">
              {p.parents.sire && (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                  <p className="text-xs text-blue-400">\u2642 Sire</p>
                  <p className="text-sm font-medium text-slate-200">{p.parents.sire}</p>
                </div>
              )}
              {p.parents.dam && (
                <div className="bg-pink-900/20 border border-pink-700/30 rounded-lg p-3">
                  <p className="text-xs text-pink-400">\u2640 Dam</p>
                  <p className="text-sm font-medium text-slate-200">{p.parents.dam}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weight history */}
        {p.weights?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Scale className="w-3 h-3" /> Weight History
            </h4>
            <div className="flex items-end gap-1 h-16">
              {p.weights.map((w, i) => {
                const maxW = Math.max(...p.weights.map(x => x.g));
                const height = maxW > 0 ? (w.g / maxW) * 100 : 50;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-emerald-500/40 rounded-t hover:bg-emerald-500/60 transition-colors"
                    style={{ height: `${height}%` }}
                    title={`${w.g}g on ${w.d}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>{p.weights[0]?.d}</span>
              <span>{p.weights[p.weights.length - 1]?.g}g latest</span>
            </div>
          </div>
        )}

        {/* Owner */}
        {p.owner && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-emerald-300 text-xs font-bold">
              {p.owner.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm text-slate-200">{p.owner.name}</p>
              <p className="text-xs text-slate-500">
                {p.owner.verified ? 'Verified breeder' : 'Breeder'}
              </p>
            </div>
          </div>
        )}

        {/* Issue date */}
        <p className="text-xs text-slate-600 text-center pt-2 border-t border-slate-800">
          Passport issued {p.issued ? format(new Date(p.issued), 'MMM d, yyyy') : 'Unknown'}
          {' \u2022 '} Verified by Geck Inspect
        </p>
      </CardContent>
    </Card>
  );
}
