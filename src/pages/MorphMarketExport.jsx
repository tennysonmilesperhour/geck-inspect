import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gecko, User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { resolveTier } from '@/lib/tierLimits';
import { createPageUrl } from '@/utils';
import { downloadBlob } from '@/lib/morphmarketSync';
import { MORPHMARKET_FIELDS, readMorphMarketSource, matchMorphMarketSource, refreshMorphMarketDraft, morphMarketChanges, morphMarketListingErrors, geckoListingSuggestions, exportPreservedMorphMarketCSV, MORPHMARKET_PRESERVATION_PROVEN } from '@/lib/morphmarketListing';
import { loadMorphMarketListings, saveMorphMarketListing } from '@/lib/morphmarketListingApi';

const groups = [...new Set(MORPHMARKET_FIELDS.map(f => f.group))];

export default function MorphMarketExport() {
  const [user, setUser] = useState(null);
  const [geckos, setGeckos] = useState([]);
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState([]);
  const [filename, setFilename] = useState('');
  const [loadedAt, setLoadedAt] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await User.me();
        if (cancelled) return;
        setUser(me);
        if (!['breeder', 'enterprise'].includes(resolveTier(me))) return;
        const [animals, details] = await Promise.all([Gecko.filter({ created_by: me.email }, '-created_date'), loadMorphMarketListings()]);
        if (cancelled) return;
        setGeckos(animals);
        setSaved(details);
        setRows(details.map(d => ({ fields: d.source_fields, draft: d.draft_fields, extra: d.source_extra, gecko: animals.find(g => g.id === d.gecko_id), conflicts: [], selected: false, issue: '', version: d.updated_date, sourceName: d.source_name })));
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const dirty = rows.some(r => r.dirty);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (index, patch) => {
    setRows(current => current.map((r, i) => i === index ? { ...r, ...patch } : r));
    setReviewed(false);
  };
  const edit = (index, key, value) => {
    const row = rows[index];
    change(index, { draft: { ...row.draft, [key]: value }, conflicts: row.conflicts.filter(k => k !== key), dirty: true });
  };

  const loadFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setReviewed(false);
    setLoadedAt(null);
    setError('');
    try {
      if (file.size > 10_000_000) throw new Error('Choose a file smaller than 10 MB.');
      const source = readMorphMarketSource(await file.text());
      const details = await loadMorphMarketListings();
      const matched = matchMorphMarketSource(source, geckos).map(row => {
        const persisted = details.find(d => d.gecko_id === row.gecko?.id);
        const local = rows.find(r => r.gecko?.id === row.gecko?.id && r.dirty);
        const previous = local ? { source_fields: local.fields, draft_fields: local.draft } : persisted;
        return { ...row, ...refreshMorphMarketDraft(row.fields, previous), selected: !row.issue, version: persisted?.updated_date, sourceName: file.name, dirty: Boolean(row.gecko) };
      });
      // Keep unsaved animals absent from this file visible, but never include them in this export.
      const absent = rows.filter(r => r.dirty && !matched.some(m => m.gecko?.id === r.gecko?.id)).map(r => ({ ...r, selected: false, issue: 'Not in the current source file. Save these edits, then load a fresh file containing this animal.' }));
      setRows([...matched, ...absent]);
      setSaved(details);
      setFilename(file.name);
      setLoadedAt(Date.now());
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const saveRows = async targets => {
    for (const row of targets) {
      const problems = morphMarketListingErrors(row.fields, row.draft);
      if (row.conflicts.length || problems.length || !row.gecko) throw new Error(problems[0] || 'Resolve matching conflicts before saving.');
      const result = await saveMorphMarketListing(row.gecko.id, row.fields, row.draft, { ...row.extra, ...(row.raw ? { original_fields: row.raw } : {}) }, row.sourceName, row.version);
      setRows(current => current.map(r => r === row ? { ...r, version: result.updated_date, dirty: false } : r));
      setSaved(current => [...current.filter(d => d.gecko_id !== row.gecko.id), result]);
    }
  };

  const save = async () => {
    setBusy(true); setError('');
    try { await saveRows(rows.filter(r => r.dirty)); toast({ title: 'Private listing details saved' }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const selected = rows.filter(r => r.selected);
  const blocked = selected.some(r => r.issue || r.conflicts.length || morphMarketListingErrors(r.fields, r.draft).length);
  const download = async () => {
    setBusy(true); setError('');
    try {
      if (blocked) throw new Error('Resolve the listed problems first.');
      const csv = exportPreservedMorphMarketCSV(selected.map(r => ({ source: r.fields, draft: r.draft })), { loadedAt, reviewed });
      await saveRows(selected);
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `morphmarket-update-${new Date().toISOString().slice(0, 10)}.csv`);
      setLoadedAt(null); setReviewed(false);
      toast({ title: 'Update CSV downloaded', description: 'Leave Synchronize/Replace off. Review every column on MorphMarket before importing.' });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!user && busy) return <p className="p-6">Loading listing details...</p>;
  if (!['breeder', 'enterprise'].includes(resolveTier(user))) return <div className="p-6"><p>MorphMarket listing tools are available on the Breeder plan.</p><Link to={createPageUrl('Membership')}>View plans</Link></div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 text-slate-100">
      <PageHeader title="MorphMarket listings" description="Keep the full listing, review your changes, then update MorphMarket." />
      {error && <p role="alert" className="rounded-lg border border-red-500 p-4 text-red-200">{error}</p>}
      <Card><CardHeader><CardTitle>1. Start with a fresh MorphMarket export</CardTitle></CardHeader><CardContent className="space-y-4">
        <p>In <a className="text-emerald-400 underline" href="https://www.morphmarket.com/inventory/" target="_blank" rel="noreferrer">MorphMarket Animal Manager</a>, export Animal Records for the listings you want to update. Load that complete CSV here immediately before each update.</p>
        <p className="text-sm text-slate-400">All 33 supported fields stay in private listing storage, including wholesale prices and private notes. Collection values are suggestions you can choose individually. New animals must first have an Animal ID on MorphMarket and a matching ID in Geck Inspect.</p>
        <Button disabled={busy} onClick={() => fileRef.current?.click()}>Load fresh MorphMarket CSV</Button>
        <input ref={fileRef} className="hidden" type="file" accept=".csv" onChange={loadFile} aria-label="Fresh MorphMarket CSV" />
        <p className="text-sm">{filename ? `Loaded: ${filename}` : `${saved.length} saved listing records. Load a fresh file to prepare an export.`}</p>
        <p className="text-sm text-slate-400">Need to add matching animals? Use <Link className="text-emerald-400 underline" to={createPageUrl('MarketplaceSell')}>Seller Console &gt; Import CSV</Link>. Existing exact IDs keep their collection details; new animals import privately.</p>
      </CardContent></Card>

      <div className="flex flex-wrap gap-3 items-center"><h2 className="text-lg font-semibold">2. Edit and review listing fields</h2><Button variant="outline" disabled={busy || !dirty} onClick={save}>Save private listing details</Button></div>
      {rows.map((row, index) => {
        const suggestions = row.gecko ? geckoListingSuggestions(row.gecko) : {};
        const changes = morphMarketChanges(row.fields, row.draft);
        const problems = morphMarketListingErrors(row.fields, row.draft);
        return <Card key={`${row.fields.Animal_ID}-${index}`}><CardHeader>
          <div className="flex gap-3 items-start"><Checkbox id={`include-${index}`} checked={row.selected} disabled={busy || !loadedAt || Boolean(row.issue)} onCheckedChange={value => change(index, { selected: Boolean(value) })} /><div><Label htmlFor={`include-${index}`} className="text-lg">{row.fields.Title}</Label><p className="text-sm text-slate-400">{row.fields.Animal_ID || 'Missing Animal ID'}{row.gecko?.archived ? ' · Archived collection record' : ''}{row.dirty ? ' · Unsaved' : ''}</p></div></div>
          {row.issue && <p className="text-amber-200">{row.issue}</p>}
        </CardHeader><CardContent className="space-y-4">
          {row.conflicts.length > 0 && <div role="alert" className="space-y-2 text-amber-200"><p>These fields changed on MorphMarket while you had saved edits. Choose which value to keep:</p>{row.conflicts.map(key => <div key={key}><p>{key}: MorphMarket "{row.fields[key]}"; saved edit "{row.draft[key]}"</p><Button variant="outline" disabled={busy} onClick={() => edit(index, key, row.fields[key])}>Keep MorphMarket value</Button>{' '}<Button variant="outline" disabled={busy} onClick={() => edit(index, key, row.draft[key])}>Keep saved edit</Button></div>)}</div>}
          {groups.map(group => <details key={group} className="rounded-lg border border-slate-700 p-3"><summary className="cursor-pointer font-medium">{group}</summary><div className="grid md:grid-cols-2 gap-4 mt-4">{MORPHMARKET_FIELDS.filter(f => f.group === group).map(field => {
            const id = `listing-${index}-${field.key}`;
            const value = row.draft[field.key];
            return <div key={field.key} className={field.multiline ? 'md:col-span-2 space-y-2' : 'space-y-2'}><Label htmlFor={id}>{field.label}</Label>
              {field.options ? <Select value={value || '__blank'} disabled={busy || !row.gecko} onValueChange={v => edit(index, field.key, v === '__blank' ? '' : v)}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__blank">Not set</SelectItem>{!field.options.includes(value) && value && <SelectItem value={value}>{value} (unrecognized)</SelectItem>}{field.options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
                : field.multiline ? <Textarea id={id} disabled={busy || !row.gecko} value={value} onChange={e => edit(index, field.key, e.target.value)} />
                  : <Input id={id} readOnly={field.locked} disabled={busy || !row.gecko} value={value} onChange={e => edit(index, field.key, e.target.value)} />}
              {field.hint && <p className="text-xs text-slate-400">{field.hint}</p>}
              {suggestions[field.key] !== undefined && suggestions[field.key] !== value && <Button variant="outline" size="sm" disabled={busy} onClick={() => edit(index, field.key, suggestions[field.key])}>Use collection value: {suggestions[field.key].slice(0, 70)}</Button>}
            </div>;
          })}</div></details>)}
          {problems.length > 0 && <ul className="text-sm text-amber-200 list-disc pl-5">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
          <h3 className="font-medium">Changes from the loaded MorphMarket file ({changes.length})</h3>
          {changes.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Field</th><th className="text-left p-2">MorphMarket</th><th className="text-left p-2">Update</th></tr></thead><tbody>{changes.map(c => <tr key={c.key} className="border-t border-slate-700"><th className="text-left p-2">{c.label}</th><td className="p-2 whitespace-pre-wrap break-all">{c.before || '(empty)'}</td><td className="p-2 whitespace-pre-wrap break-all">{c.after || '(empty)'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-400">No field changes.</p>}
        </CardContent></Card>;
      })}

      <Card><CardHeader><CardTitle>3. Review the update file</CardTitle></CardHeader><CardContent className="space-y-4">
        {!MORPHMARKET_PRESERVATION_PROVEN && <p className="text-amber-200">Downloads are paused while we test the full field preservation on real MorphMarket listings. You can save and edit private listing details now.</p>}
        <p>Blanking an existing value, changing an Animal ID, incomplete files and unrecognized fields block export. MorphMarket changes made after your source file cannot be detected here. Export and upload promptly, with Synchronize/Replace off.</p>
        <div className="flex gap-3 items-start"><Checkbox id="reviewed-update" checked={reviewed} disabled={busy || !loadedAt} onCheckedChange={v => setReviewed(Boolean(v))} /><Label htmlFor="reviewed-update">I just exported this source from MorphMarket, have made no changes there since, and reviewed all selected listing changes. My MorphMarket currency matches these prices.</Label></div>
        <Button disabled={busy || !MORPHMARKET_PRESERVATION_PROVEN || !loadedAt || !reviewed || !selected.length || blocked} onClick={download}>Download {selected.length} listing updates</Button>
        <p className="text-xs text-slate-400">A new source file is required after each download or after 30 minutes. Read-only MorphMarket history, parent links and counters are retained as reference and are not sent to the importer.</p>
      </CardContent></Card>
    </div>
  );
}
