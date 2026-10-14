import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import GeckoArtworkPicker from '@/components/my-geckos/form/GeckoArtworkPicker';
import { useAuth } from '@/lib/AuthContext';
import { normalizeGeckoArtStyle } from '@/lib/geckoPlaceholderProfiles';
import { supabase } from '@/lib/supabaseClient';
import { queryClientInstance } from '@/lib/query-client';
import { dataCache } from '@/lib/layoutCache';
import { useToast } from '@/components/ui/use-toast';

/** A saved account preference, independent of the general profile form. */
export default function CollectionArtworkSetting({ user }) {
  const [style, setStyle] = useState(() => normalizeGeckoArtStyle(user?.gecko_artwork_style));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { mergeUserExtras } = useAuth();
  const { toast } = useToast();

  async function change(next) {
    if (saving || !user?.email || next === style) return;
    const before = style;
    setStyle(next);
    setSaving(true);
    setError('');
    try {
      // A narrow update avoids overwriting unrelated settings. The database
      // carries the inherited style onto owner records for every viewer.
      const { data, error: saveError } = await supabase.from('profiles')
        .update({ gecko_artwork_style: next }).eq('email', user.email)
        .select('gecko_artwork_style').single();
      if (saveError) throw saveError;
      const saved = normalizeGeckoArtStyle(data.gecko_artwork_style);
      setStyle(saved);
      mergeUserExtras({ gecko_artwork_style: saved }, user.auth_user_id);
      dataCache.clearAll();
      void queryClientInstance.invalidateQueries();
      window.dispatchEvent(new Event('geckos_changed'));
      toast({ title: 'Collection artwork saved', description: 'Your individual gecko choices are kept.' });
    } catch {
      setStyle(before);
      setError('Could not save your collection style. Your previous choice is still active. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-3">
    <GeckoArtworkPicker
      collectionDefault
      gecko={{ id: 'collection-art-preview', name: 'Collection preview', placeholder_style: style }}
      onChange={change}
      disabled={saving || !user?.email}
    />
    <p className="flex items-center gap-2 text-xs text-slate-400" role="status">
      {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Saving your collection style…</>
        : 'Saves automatically across devices. Shared geckos use their owner’s default.'}
    </p>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div>;
}
