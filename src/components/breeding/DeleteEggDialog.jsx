import { useState } from 'react';
import { Egg } from '@/entities/all';
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

/**
 * Deleting an egg removes the record for good (for an egg entered by
 * mistake). Archiving is separate: it only hides a resolved egg from the
 * active list and keeps it in the Hatchery archive and the breeding
 * history. Open by passing an egg; pass null to keep it closed.
 */
export default function DeleteEggDialog({ egg, onClose, onDeleted }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(null);

    const handleDelete = async (e) => {
        e.preventDefault();
        if (!egg) return;
        setIsDeleting(true);
        setError(null);
        try {
            await Egg.delete(egg.id);
            onDeleted?.(egg);
        } catch (err) {
            setError(err?.message || 'The egg could not be deleted. Please try again.');
        }
        setIsDeleting(false);
    };

    return (
        <AlertDialog open={!!egg} onOpenChange={(open) => { if (!open && !isDeleting) { setError(null); onClose?.(); } }}>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-slate-100">Delete this egg?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                        This removes the egg record for good, including from the breeding history and hatch rates. Use it for an egg entered by mistake. To keep the record but hide it, archive the egg instead.
                        {egg?.gecko_id ? ' The gecko it hatched into stays in your collection.' : ''}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
                <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600" disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-700 hover:bg-red-800">
                        {isDeleting ? 'Deleting...' : 'Delete egg'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
