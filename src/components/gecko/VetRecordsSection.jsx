import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Stethoscope, Plus, Pencil, Trash2, Loader2, Paperclip, X, ChevronRight, BellRing } from 'lucide-react';
import { VetRecord } from '@/entities/all';
import { uploadFile } from '@/lib/uploadFile';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import {
  MAX_VET_ATTACHMENTS,
  buildVetRecordPayload,
  emptyVetForm,
  followUpStatus,
  sortVetRecords,
  vetFormError,
  vetFormFromRecord,
} from '@/lib/vetRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';

const fmtDay = (iso) => (iso ? format(parseLocalDate(iso), 'MMM d, yyyy') : '');

const FOLLOW_UP_BADGE = {
  upcoming: 'border-sky-700 text-sky-300',
  today: 'border-amber-600 text-amber-300',
  past: 'border-slate-600 text-slate-400',
};

/**
 * Vet visits for one gecko: list, add, edit and delete. Used in the gecko
 * record window (My Geckos) and on /GeckoDetail for the owner. A visit
 * with a follow-up date gets a reminder on that day from the daily
 * enqueue_vet_followups() job, and every visit shows on the gecko's
 * public passport when it has one.
 *
 * canEdit: whether the viewer may add visits. Editing and deleting are
 * limited to the member who logged the visit (the database allows no one
 * else), so a collaborator's visits show without those buttons.
 */
export default function VetRecordsSection({ gecko, canEdit = true, currentUserEmail = null, headingClassName, iconClassName = 'w-5 h-5' }) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const fileInputRef = useRef(null);

  const geckoId = gecko?.id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!geckoId) return;
      setIsLoading(true);
      try {
        const rows = await VetRecord.filter({ animal_id: geckoId }, '-date');
        if (!cancelled) setRecords(sortVetRecords(rows));
      } catch (error) {
        console.error('Failed to load vet records:', error);
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [geckoId]);

  if (!gecko) return null;

  const today = todayLocalISO();
  const canChange = (record) => canEdit && (!currentUserEmail || !record.created_by || record.created_by === currentUserEmail);
  const onPassport = Boolean(gecko.passport_code && gecko.is_public);

  const startAdd = () => { setEditingId(null); setForm(emptyVetForm(today)); };
  const startEdit = (record) => { setEditingId(record.id); setForm(vetFormFromRecord(record)); };
  const cancelForm = () => { setEditingId(null); setForm(null); };
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const room = MAX_VET_ATTACHMENTS - (form?.attachments?.length || 0);
    if (room <= 0) {
      toast({ title: 'Attachment limit reached', description: `A visit can hold up to ${MAX_VET_ATTACHMENTS} photos.`, variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    try {
      const urls = [];
      for (const file of files.slice(0, room)) {
        const { file_url } = await uploadFile({ file, folder: 'vet-records' });
        urls.push(file_url);
      }
      setForm((f) => ({ ...f, attachments: [...(f.attachments || []), ...urls] }));
      if (files.length > room) {
        toast({ title: `Only ${room} added`, description: `A visit can hold up to ${MAX_VET_ATTACHMENTS} photos.` });
      }
    } catch (error) {
      toast({ title: 'Upload failed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    const problem = vetFormError(form);
    if (problem) {
      toast({ title: 'Check the visit', description: problem, variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        const saved = await VetRecord.update(editingId, buildVetRecordPayload(form));
        setRecords((rows) => sortVetRecords(rows.map((r) => (r.id === editingId ? { ...r, ...saved } : r))));
      } else {
        const saved = await VetRecord.create(buildVetRecordPayload(form, gecko.id));
        setRecords((rows) => sortVetRecords([saved, ...rows]));
      }
      const followUp = form.follow_up;
      toast({
        title: editingId ? 'Vet visit updated' : 'Vet visit saved',
        description: followUp && followUp >= today
          ? `We will remind you about the follow-up on ${fmtDay(followUp)}.`
          : onPassport ? 'It shows on this gecko\'s passport.' : undefined,
      });
      cancelForm();
    } catch (error) {
      console.error('Failed to save vet record:', error);
      toast({ title: 'Could not save the visit', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      await VetRecord.delete(toDelete.id);
      setRecords((rows) => rows.filter((r) => r.id !== toDelete.id));
      if (editingId === toDelete.id) cancelForm();
    } catch (error) {
      console.error('Failed to delete vet record:', error);
      toast({ title: 'Could not delete the visit', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
    setToDelete(null);
  };

  return (
    <div>
      <h3 className={headingClassName || 'text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2'}>
        <Stethoscope className={iconClassName} />
        Vet Visits
      </h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : records.length > 0 ? (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {records.map((record) => {
            const status = followUpStatus(record, today);
            const expanded = expandedId === record.id;
            const hasDetails = record.findings || record.treatment || record.follow_up || record.attachments?.length;
            return (
              <div key={record.id} className="bg-slate-800 p-3 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left touch:min-h-11"
                    onClick={() => setExpandedId(expanded ? null : record.id)}
                    aria-expanded={expanded}
                  >
                    <p className="text-slate-200 font-medium text-sm flex items-center gap-1">
                      {hasDetails && (
                        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                      )}
                      <span className="truncate">{record.reason || 'Vet visit'}</span>
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {fmtDay(record.date)}
                      {record.vet_name && `, ${record.vet_name}`}
                    </p>
                    {status && status !== 'past' && (
                      <Badge variant="outline" className={`mt-1.5 text-[11px] ${FOLLOW_UP_BADGE[status]}`}>
                        <BellRing className="w-3 h-3 mr-1" />
                        {status === 'today' ? 'Follow-up today' : `Follow-up ${fmtDay(record.follow_up)}`}
                      </Badge>
                    )}
                  </button>
                  {canChange(record) && (
                    <div className="flex items-center flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7" onClick={() => startEdit(record)} aria-label="Edit vet visit">
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 md:h-7 md:w-7" onClick={() => setToDelete(record)} aria-label="Delete vet visit">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
                {expanded && hasDetails && (
                  <div className="mt-2 pt-2 border-t border-slate-700 space-y-2 text-xs">
                    {record.findings && (
                      <div>
                        <p className="uppercase tracking-wider text-slate-500">Findings</p>
                        <p className="text-slate-300 whitespace-pre-wrap">{record.findings}</p>
                      </div>
                    )}
                    {record.treatment && (
                      <div>
                        <p className="uppercase tracking-wider text-slate-500">Treatment</p>
                        <p className="text-slate-300 whitespace-pre-wrap">{record.treatment}</p>
                      </div>
                    )}
                    {record.follow_up && (
                      <div>
                        <p className="uppercase tracking-wider text-slate-500">Follow-up</p>
                        <p className="text-slate-300">{fmtDay(record.follow_up)}</p>
                      </div>
                    )}
                    {record.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {record.attachments.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={url} alt="Vet visit attachment" loading="lazy" className="w-14 h-14 object-cover rounded border border-slate-700" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-slate-400 text-center py-4 text-sm">No vet visits logged yet.</p>
      )}

      {canEdit && !form && (
        <Button onClick={startAdd} variant="outline" size="sm" className="w-full mt-4">
          <Plus className="w-4 h-4 mr-2" /> Log Vet Visit
        </Button>
      )}

      {form && (
        <div className="mt-4 space-y-3 border border-slate-700 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-200">{editingId ? 'Edit vet visit' : 'New vet visit'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="vet-date" className="text-xs text-slate-400">Date of visit</Label>
              <Input id="vet-date" type="date" value={form.date} max={today} onChange={(e) => setField('date', e.target.value)} className="bg-slate-800 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vet-name" className="text-xs text-slate-400">Vet or clinic</Label>
              <Input id="vet-name" value={form.vet_name} onChange={(e) => setField('vet_name', e.target.value)} placeholder="Dr. Rivera, Exotic Pet Clinic" className="bg-slate-800 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vet-reason" className="text-xs text-slate-400">Reason</Label>
            <Input id="vet-reason" value={form.reason} onChange={(e) => setField('reason', e.target.value)} placeholder="Annual checkup, fecal test, tail injury" className="bg-slate-800 text-sm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vet-findings" className="text-xs text-slate-400">Findings</Label>
            <Textarea id="vet-findings" rows={2} value={form.findings} onChange={(e) => setField('findings', e.target.value)} className="bg-slate-800 text-sm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vet-treatment" className="text-xs text-slate-400">Treatment</Label>
            <Textarea id="vet-treatment" rows={2} value={form.treatment} onChange={(e) => setField('treatment', e.target.value)} className="bg-slate-800 text-sm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vet-follow-up" className="text-xs text-slate-400">Follow-up date (optional)</Label>
            <Input id="vet-follow-up" type="date" value={form.follow_up} min={form.date || undefined} onChange={(e) => setField('follow_up', e.target.value)} className="bg-slate-800 text-sm" />
            <p className="text-[11px] text-slate-500">You get a reminder that morning.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Attachments (photos of results, X-rays or paperwork)</Label>
            {form.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.attachments.map((url) => (
                  <div key={url} className="relative">
                    <img src={url} alt="Vet visit attachment" className="w-14 h-14 object-cover rounded border border-slate-700" />
                    <button
                      type="button"
                      onClick={() => setField('attachments', form.attachments.filter((u) => u !== url))}
                      className="absolute -top-1.5 -right-1.5 bg-slate-900 border border-slate-600 rounded-full p-0.5"
                      aria-label="Remove attachment"
                    >
                      <X className="w-3 h-3 text-slate-300" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading || form.attachments.length >= MAX_VET_ATTACHMENTS}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
              {isUploading ? 'Uploading...' : 'Add photos'}
            </Button>
          </div>
          {onPassport && (
            <p className="text-[11px] text-slate-500">This visit shows on the gecko&apos;s public passport, without the attachments.</p>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving || isUploading} className="flex-1">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingId ? 'Save changes' : 'Save visit'}
            </Button>
            <Button variant="outline" onClick={cancelForm} disabled={isSaving}>Cancel</Button>
          </div>
        </div>
      )}

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete this vet visit?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This permanently deletes the visit from {fmtDay(toDelete?.date)}{toDelete?.follow_up ? ' and its follow-up reminder' : ''}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-700 hover:bg-red-800">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
