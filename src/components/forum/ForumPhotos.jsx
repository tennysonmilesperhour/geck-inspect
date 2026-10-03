import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { uploadFile } from '@/lib/uploadFile';
import { ImagePlus, Loader2, X } from 'lucide-react';

/** Most photos a forum post can carry. Enough for a top, side and close-up shot. */
export const MAX_FORUM_PHOTOS = 4;

/** image_urls is jsonb; older rows can hold null or a non-array. */
export function forumPhotoList(value) {
    return Array.isArray(value) ? value.filter((u) => typeof u === 'string' && u) : [];
}

/**
 * Photo picker for a forum post. Uploads through the shared uploadFile
 * helper (resizes, converts iPhone HEIC, checks the storage quota) and
 * hands back the list of public URLs.
 */
export function ForumPhotoPicker({ value, onChange, disabled = false }) {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const photos = forumPhotoList(value);
    const room = MAX_FORUM_PHOTOS - photos.length;

    const handleFiles = async (event) => {
        const files = Array.from(event.target.files || []).slice(0, Math.max(room, 0));
        event.target.value = '';
        if (files.length === 0) return;
        setIsUploading(true);
        const added = [];
        for (const file of files) {
            try {
                const { file_url } = await uploadFile({ file, folder: 'forum' });
                added.push(file_url);
            } catch (error) {
                toast({
                    title: 'Photo not added',
                    description: error.message || 'Try a different photo.',
                    variant: 'destructive',
                });
            }
        }
        if (added.length) onChange([...photos, ...added]);
        setIsUploading(false);
    };

    return (
        <div className="space-y-2">
            {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {photos.map((url) => (
                        <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => onChange(photos.filter((u) => u !== url))}
                                disabled={disabled || isUploading}
                                className="absolute top-1 right-1 touch:min-h-11 touch:min-w-11 flex items-center justify-center rounded-full bg-slate-950/80 p-1 text-slate-200 hover:text-rose-300"
                                aria-label="Remove photo"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFiles}
            />
            <div className="flex items-center gap-3 flex-wrap">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || isUploading || room <= 0}
                    onClick={() => inputRef.current?.click()}
                    className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                    {isUploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <ImagePlus className="w-4 h-4 mr-2" />
                    )}
                    {isUploading ? 'Uploading...' : 'Add photos'}
                </Button>
                <span className="text-xs text-slate-500">
                    Up to {MAX_FORUM_PHOTOS}. For a morph question, a clear top and side shot in daylight helps most.
                </span>
            </div>
        </div>
    );
}

/** Read-only photo grid for a post. Each photo opens full size in a new tab. */
export function ForumPhotoGrid({ value }) {
    const photos = forumPhotoList(value);
    if (photos.length === 0) return null;
    return (
        <div className={`grid gap-2 mt-4 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {photos.map((url, i) => (
                <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg overflow-hidden border border-slate-800 bg-slate-950"
                >
                    <img
                        src={url}
                        alt={`Photo ${i + 1} of ${photos.length}`}
                        loading="lazy"
                        className={`w-full object-cover ${photos.length === 1 ? 'max-h-[32rem] object-contain' : 'aspect-square'}`}
                    />
                </a>
            ))}
        </div>
    );
}
