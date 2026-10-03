import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, EyeOff, Eye, Trash2, Check, Loader2, Flag, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { REPORT_CATEGORIES, REPORT_TARGETS, moderateContent, reportTargetLink } from '@/lib/moderation';

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'actioned', label: 'Acted on' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All' },
];

const CATEGORY_LABELS = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.value, c.label]));

const ACTION_DONE = {
  hide: 'Hidden. Only the owner and admins can see it now.',
  unhide: 'Visible again.',
  remove: 'Removed.',
  dismiss: 'Report dismissed.',
};

function timeAgo(date) {
  if (!date) return '';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Admin Reports view. Every report members file with the Report button,
 * with the reported item beside it and one-tap Hide. Hide makes the item
 * invisible to other members and signed-out visitors (the database
 * enforces it); Remove takes it down for good; Dismiss closes the report.
 */
export default function ReportsQueue({ onCountChange }) {
  const [filter, setFilter] = useState('open');
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc('admin_content_reports', { p_status: filter, p_limit: 300 });
    if (error) {
      setLoadError(error.message);
      setReports([]);
    } else {
      setReports(Array.isArray(data) ? data : []);
      if (filter === 'open') onCountChange?.(Array.isArray(data) ? data.length : 0);
    }
    setIsLoading(false);
  }, [filter, onCountChange]);

  useEffect(() => { load(); }, [load]);

  const act = async (report, action) => {
    const key = `${report.id}:${action}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      await moderateContent(report.target_type, report.target_id, action);
      toast({ title: ACTION_DONE[action] });
      setRemoveTarget(null);
      await load();
    } catch (error) {
      toast({ title: 'That did not work', description: error.message, variant: 'destructive' });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Flag className="w-5 h-5 text-rose-300" /> Reports
        </CardTitle>
        <p className="text-sm text-slate-400">
          What members reported with the Report button. Hide takes an item out of view for everyone except its
          owner and admins, and can be undone. Remove is permanent for posts, comments and photos. Older reports
          sent before 3 October 2026 are in the Support inbox.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? 'default' : 'outline'}
              onClick={() => setFilter(f.value)}
              className="touch:min-h-11"
            >
              {f.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load} className="touch:min-h-11 ml-auto" aria-label="Refresh reports">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : loadError ? (
          <p role="alert" className="text-sm text-rose-300 py-6">Could not load reports: {loadError}</p>
        ) : reports.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">
            {filter === 'open' ? 'No open reports. Nice and quiet.' : 'Nothing here.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const meta = REPORT_TARGETS[r.target_type] || { label: r.target_type };
              const t = r.target;
              const gone = !t;
              const hidden = Boolean(t?.hidden);
              const link = gone ? null : reportTargetLink(r);
              const busy = (a) => busyKey === `${r.id}:${a}`;
              return (
                <li key={r.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex gap-3">
                    {t?.image_url ? (
                      <img
                        src={t.image_url}
                        alt=""
                        className="w-20 h-20 md:w-24 md:h-24 rounded-md object-cover bg-slate-800 shrink-0"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="border-slate-600 text-slate-300">{meta.label}</Badge>
                        <Badge variant="outline" className="border-rose-800/60 text-rose-300">{CATEGORY_LABELS[r.category] || r.category}</Badge>
                        {hidden && <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40">Hidden</Badge>}
                        {gone && <Badge className="bg-slate-700 text-slate-300">Already gone</Badge>}
                        {r.reports_on_target > 1 && (
                          <Badge className="bg-rose-500/20 text-rose-200 border border-rose-500/40">{r.reports_on_target} reports</Badge>
                        )}
                        {r.status !== 'open' && (
                          <Badge variant="secondary">{r.action_taken || r.status}</Badge>
                        )}
                      </div>
                      {t?.title && <p className="text-sm font-semibold text-slate-100 truncate">{t.title}</p>}
                      {t?.text && <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap">{t.text}</p>}
                      {!t?.text && r.excerpt && (
                        <p className="text-xs text-slate-500 line-clamp-3 whitespace-pre-wrap">As reported: {r.excerpt}</p>
                      )}
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">
                        <span className="text-slate-500">Reason: </span>{r.reason}
                      </p>
                      <p className="text-[11px] text-slate-500 break-all">
                        Reported by {r.reporter_email} {timeAgo(r.created_at)}
                        {t?.owner_email ? ` · Owner: ${t.owner_email}` : ''}
                        {r.resolved_at ? ` · Closed ${timeAgo(r.resolved_at)}${r.resolved_by ? ` by ${r.resolved_by}` : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {meta.canHide && !gone && (
                      hidden ? (
                        <Button size="sm" variant="outline" disabled={!!busyKey} onClick={() => act(r, 'unhide')} className="touch:min-h-11">
                          {busy('unhide') ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Eye className="w-4 h-4 mr-1.5" />}
                          Unhide
                        </Button>
                      ) : (
                        <Button size="sm" disabled={!!busyKey} onClick={() => act(r, 'hide')} className="touch:min-h-11 bg-amber-600 hover:bg-amber-500 text-white">
                          {busy('hide') ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <EyeOff className="w-4 h-4 mr-1.5" />}
                          Hide
                        </Button>
                      )
                    )}
                    {meta.canRemove && !gone && (
                      <Button size="sm" variant="outline" disabled={!!busyKey} onClick={() => setRemoveTarget(r)} className="touch:min-h-11 border-rose-900/60 text-rose-300 hover:bg-rose-950/40">
                        <Trash2 className="w-4 h-4 mr-1.5" /> {meta.removeLabel || 'Remove'}
                      </Button>
                    )}
                    {r.status === 'open' && (
                      <Button size="sm" variant="ghost" disabled={!!busyKey} onClick={() => act(r, 'dismiss')} className="touch:min-h-11 text-slate-300">
                        {busy('dismiss') ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                        {gone ? 'Close' : 'Dismiss'}
                      </Button>
                    )}
                    {link && (
                      <Button size="sm" variant="ghost" asChild className="touch:min-h-11 text-emerald-300 ml-auto">
                        <a href={link} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1.5" /> Open
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeTarget ? (REPORT_TARGETS[removeTarget.target_type]?.removeLabel || 'Remove') : 'Remove'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {removeTarget && ['forum_post', 'forum_comment', 'gecko_image'].includes(removeTarget.target_type)
                ? 'This permanently erases it (a forum post takes its comments with it). Hide instead if you might want it back.'
                : 'This takes it out of public view and clears what the reports were about. The member keeps their account and private records.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (removeTarget) act(removeTarget, 'remove'); }}
              disabled={!!busyKey}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {busyKey?.endsWith(':remove') && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
