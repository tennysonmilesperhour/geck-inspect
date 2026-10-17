import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Ruler, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import RecordCard from './RecordCard';
import { REMOVED_WITH_GECKO } from './recordModel';

const ARCHIVE_REASONS = [
  { value: 'death', label: 'Passed away' },
  { value: 'sold', label: 'Sold' },
  { value: 'other', label: 'Other' },
];

/**
 * Housekeeping for a keeper who may edit: grading, archiving (with the
 * reason, where Sold asks for the price first), and deleting for good.
 * Delete shows only for the gecko's owner (or an admin) and only once it
 * is archived, behind a confirmation: a collection editor can archive a
 * shared gecko but never delete it, because deleting removes every care
 * record with it.
 *
 *   onArchive(id, shouldArchive)  archive (asks for a reason) or restore
 *   onReason(reason)              change an archived gecko's reason
 *   onDelete(id)                  delete for good (after the confirmation)
 */
export default function RecordManage({ gecko, access, onArchive, onReason, onDelete, headingAs }) {
  if (!access.canEdit) return null;
  const name = gecko.name || 'this gecko';
  return (
    <RecordCard id="manage" icon={Settings2} title="Manage" headingAs={headingAs} contentClassName="flex flex-wrap items-start gap-3">
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link to={`/QualityScale?geckoId=${gecko.id}`}><Ruler className="w-4 h-4 mr-2" /> Score structure</Link>
      </Button>

      {gecko.archived && gecko.archive_reason && onReason && (
        <div className="w-full bg-slate-800 p-3 rounded-lg">
          <p className="text-xs text-slate-400 mb-2">Why it is archived</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Archive reason">
            {ARCHIVE_REASONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={gecko.archive_reason === opt.value ? 'default' : 'outline'}
                onClick={() => onReason(opt.value)}
                aria-pressed={gecko.archive_reason === opt.value}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {onArchive && (
        <Button
          variant="outline"
          onClick={() => onArchive(gecko.id, !gecko.archived)}
          className="w-full sm:w-auto h-auto min-h-9 whitespace-normal text-left"
        >
          {gecko.archived
            ? <><ArchiveRestore className="w-4 h-4 mr-2" /> Unarchive</>
            : <><Archive className="w-4 h-4 mr-2" /> Archive (sold, passed away or other)</>}
        </Button>
      )}

      {gecko.archived && onDelete && access.canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto border-red-800 text-red-400 hover:bg-red-950/40 hover:text-red-300">
              <Trash2 className="w-4 h-4 mr-2" /> Delete for good
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-slate-900 border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-100">Delete {name} for good?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                This <strong className="text-red-400">permanently removes</strong> {name} and {REMOVED_WITH_GECKO}.
                It cannot be undone. Archiving keeps the history instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(gecko.id)} className="bg-red-700 hover:bg-red-800">
                Delete for good
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </RecordCard>
  );
}
