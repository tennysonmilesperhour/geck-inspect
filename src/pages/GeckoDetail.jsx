import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { api } from '@/api/appClient';
import { Gecko, CollectionMember } from '@/entities/all';
import { canWriteGecko } from '@/lib/geckoAccess';
import { isGeckoLimitError } from '@/lib/geckoLimit';
import { queryClientInstance } from '@/lib/query-client';
import { createPageUrl } from '@/utils';
import GeckoRecord from '@/components/gecko/record/GeckoRecord';
import { myGeckosHandoff, recordAccess } from '@/components/gecko/record/recordModel';

// What unarchiving clears, the same fields My Geckos clears
// (handleArchiveGecko in src/pages/MyGeckos.jsx): the gecko is back in the
// collection and no longer counts as a sale.
const UNARCHIVE_FIELDS = Object.freeze({
  archived: false,
  archived_date: null,
  archive_reason: null,
  sold_price: null,
  sale_category: null,
});

// My Geckos keeps its collection in a two-minute cache. A change made here
// marks it stale, so going back to the list shows the change at once, and
// tells the rest of the app (the Dashboard counts) the same way every
// other page does.
function collectionChanged() {
  queryClientInstance.invalidateQueries({ queryKey: ['my-geckos'] });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('geckos_changed'));
}

/**
 * /GeckoDetail?id=<gecko id>: one gecko's record as a page. Reminder and
 * vet follow-up links, passports, breeder and profile pages, the market and
 * the family tree all open it. It shows the same record as the window in
 * My Geckos (GeckoRecord), so the gecko's keepers can log a weigh-in, a
 * feeding or a vet visit right here; anyone else sees the public parts.
 *
 * The edit form and archiving with sale details live in My Geckos, so
 * Edit and Archive open this gecko there with the form or the dialog
 * ready. Unarchive and delete (after its confirmation) happen here.
 */
export default function GeckoDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const geckoId = new URLSearchParams(location.search).get('id');
  const [state, setState] = useState({ status: 'loading', gecko: null, user: null, memberships: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!geckoId) {
        setState({ status: 'missing', gecko: null, user: null, memberships: [] });
        return;
      }
      setState((s) => ({ ...s, status: 'loading' }));
      const [geckoResult, userResult] = await Promise.allSettled([
        Gecko.get(geckoId),
        api.auth.me(),
      ]);
      const gecko = geckoResult.status === 'fulfilled' ? geckoResult.value : null;
      const user = userResult.status === 'fulfilled' ? userResult.value : null;
      // Collection memberships decide whether an editor may change it and
      // whether a viewer sees the private care history. Row rules already
      // limit this list to the member's own collections.
      const memberships = gecko && user?.email
        ? await CollectionMember.filter({ status: 'accepted' }).catch(() => [])
        : [];
      if (cancelled) return;
      if (geckoResult.status === 'rejected') console.error('Failed to load gecko details:', geckoResult.reason);
      setState({ status: gecko ? 'ready' : 'missing', gecko, user, memberships: memberships || [] });
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
    })();
    return () => { cancelled = true; };
  }, [geckoId]);

  const { gecko, user, memberships } = state;

  const reloadGecko = useCallback(async () => {
    if (!geckoId) return;
    collectionChanged();
    try {
      const fresh = await Gecko.get(geckoId);
      if (fresh) setState((s) => ({ ...s, gecko: fresh }));
    } catch (error) {
      console.error('Failed to reload the gecko:', error);
    }
  }, [geckoId]);

  if (state.status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-slate-950" role="status" aria-label="Loading the gecko record">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!gecko) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-xl mx-auto text-center text-slate-300 space-y-3 pt-10">
          <h1 className="text-xl font-semibold text-slate-100">Gecko not found</h1>
          <p className="text-sm text-slate-400">The link may be wrong, or the keeper may have made this gecko private.</p>
          <Button asChild variant="outline"><Link to={createPageUrl('MyGeckos')}>Go to My Geckos</Link></Button>
        </div>
      </div>
    );
  }

  const canEdit = canWriteGecko(gecko, user, memberships);
  const isMember = (memberships || []).some((m) => m.collection_id && m.collection_id === gecko.collection_id);
  const access = recordAccess({ gecko, user, canEdit, isMember });

  // Back goes to wherever the member came from; opened from an email or a
  // notification there is nowhere to go back to, so it goes home instead.
  const goBack = () => {
    if (location.key && location.key !== 'default') navigate(-1);
    else navigate(access.keeper ? createPageUrl('MyGeckos') : '/');
  };

  const handleArchive = async (id, shouldArchive) => {
    if (shouldArchive) {
      navigate(myGeckosHandoff(id, 'archive'));
      return;
    }
    try {
      await Gecko.update(id, UNARCHIVE_FIELDS);
      toast({ title: 'Gecko unarchived', description: `${gecko.name || 'It'} is back in your collection.` });
      await reloadGecko();
    } catch (error) {
      if (isGeckoLimitError(error)) {
        toast({
          title: 'Your plan is full',
          description: 'Archive another gecko or upgrade on the Membership page to bring this one back.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Could not unarchive', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await Gecko.delete(id);
      collectionChanged();
      toast({ title: 'Gecko deleted', description: 'The gecko and its records have been permanently removed.' });
      navigate(createPageUrl('MyGeckos'), { replace: true });
    } catch (error) {
      console.error('Failed to delete gecko:', error);
      toast({ title: 'Could not delete the gecko', description: 'Please try again in a moment.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 md:p-8">
      <div className="max-w-5xl mx-auto md:rounded-xl md:border md:border-slate-800 md:bg-slate-950">
        <GeckoRecord
          key={gecko.id}
          gecko={gecko}
          currentUser={user}
          canEdit={canEdit}
          isMember={isMember}
          variant="page"
          leading={(
            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          onUpdate={reloadGecko}
          onEdit={() => navigate(myGeckosHandoff(gecko.id, 'edit'))}
          onArchive={handleArchive}
          onMarkSold={(id) => navigate(myGeckosHandoff(id, 'sold'))}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
