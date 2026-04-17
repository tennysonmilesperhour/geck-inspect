import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wand2, ArrowDown } from 'lucide-react';
import { normalizeMorphText } from './normalizeMorphText';
import { labelFor } from './morphTaxonomy';

export default function WebImportPanel({ onApply }) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [text, setText] = useState('');

  const parsed = useMemo(() => normalizeMorphText(text), [text]);
  const anyMatch = parsed.primary_morph
    || parsed.genetic_traits.length
    || parsed.secondary_traits.length;

  const apply = () => {
    if (!anyMatch) return;
    onApply?.({
      primary_morph: parsed.primary_morph || '',
      genetics: parsed.genetic_traits,
      secondary_traits: parsed.secondary_traits,
      base_color: parsed.base_color || '',
      photo: { fired_state: parsed.fired_state || 'unknown' },
      geneticsCtx: {
        age_stage: parsed.age_stage || 'unknown',
        sex: parsed.sex || 'unknown',
        known_hets: parsed.known_hets,
      },
      notes: sourceUrl ? `Imported from ${sourceUrl}\n\n${text}` : text,
      provenance: 'web_crawl',
    });
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-emerald-400" />
          Web-import (paste a listing, get a draft)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-slate-400 text-sm">
          Paste a MorphMarket description, Instagram caption, or breeder
          listing. We'll map the free text into canonical taxonomy ids and
          prefill the contribution form below. Anything we can't map shows
          up as <span className="text-amber-300">unmapped</span> so you can
          extend the alias table — nothing is silently dropped.
        </p>

        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Source URL (optional)</Label>
          <Input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://morphmarket.com/..."
            className="bg-slate-800 border-slate-600 text-slate-100"
          />
        </div>

        <div>
          <Label className="text-slate-300 text-xs uppercase tracking-wide">Listing text</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={'e.g. "Extreme Harlequin Pinstripe het Axanthic (VCA), adult female, fired up"'}
            className="bg-slate-800 border-slate-600 text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Readout title="Primary morph">
            {parsed.primary_morph
              ? <Badge className="bg-emerald-600">{labelFor(parsed.primary_morph)}</Badge>
              : <span className="text-slate-500 text-sm">—</span>}
          </Readout>

          <Readout title="Base color">
            {parsed.base_color
              ? <Badge variant="secondary" className="bg-slate-700 text-slate-200">{labelFor(parsed.base_color)}</Badge>
              : <span className="text-slate-500 text-sm">—</span>}
          </Readout>

          <Readout title="Genetic traits">
            <Tokens ids={parsed.genetic_traits} />
          </Readout>

          <Readout title="Known hets">
            <Tokens ids={parsed.known_hets} prefix="het " />
          </Readout>

          <Readout title="Secondary traits">
            <Tokens ids={parsed.secondary_traits} />
          </Readout>

          <Readout title="Sex · life stage · fired">
            <span className="text-sm text-slate-200">
              {parsed.sex || '—'} · {parsed.age_stage || '—'} · {parsed.fired_state || '—'}
            </span>
          </Readout>
        </div>

        {parsed.unmapped.length > 0 && (
          <div>
            <Label className="text-slate-300 text-xs uppercase tracking-wide mb-1 block">
              Unmapped tokens
            </Label>
            <div className="flex flex-wrap gap-1">
              {parsed.unmapped.map((t) => (
                <Badge key={t} variant="secondary" className="bg-amber-900/30 text-amber-200 border border-amber-700/40">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={apply}
          disabled={!anyMatch}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <ArrowDown className="w-4 h-4 mr-2" /> Apply to contribution form
        </Button>
      </CardContent>
    </Card>
  );
}

function Readout({ title, children }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{title}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Tokens({ ids = [], prefix = '' }) {
  if (!ids.length) return <span className="text-slate-500 text-sm">—</span>;
  return ids.map((id) => (
    <Badge key={id} variant="secondary" className="bg-slate-700 text-slate-200">
      {prefix}{labelFor(id)}
    </Badge>
  ));
}
