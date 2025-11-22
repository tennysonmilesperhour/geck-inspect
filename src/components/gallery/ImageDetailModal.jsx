import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ImageDetailModal({ data, onClose }) {
    if (!data || !data.image) {
        return null;
    }
    const { image, uploader } = data;

    const morphDisplayName = image.primary_morph
        ? image.primary_morph.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : 'Unknown';

    const uploaderName = uploader?.full_name || image.created_by.split('@')[0];

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-slate-900 border-slate-700 text-white">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-slate-100">{morphDisplayName}</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Uploaded by{' '}
                        {uploader ? (
                            <Link to={createPageUrl(`PublicProfile?userId=${uploader.id}`)} className="text-emerald-400 hover:underline">
                                {uploaderName}
                            </Link>
                        ) : (
                            <span>{uploaderName}</span>
                        )}
                        {' '} about {formatDistanceToNow(new Date(image.created_date), { addSuffix: true })}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <div className="relative">
                            <img src={image.image_url} alt={morphDisplayName} className="rounded-lg w-full h-auto object-contain" />
                            {image.verified && (
                                <div className="absolute top-3 left-3 flex items-center gap-2 bg-green-600/80 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    <CheckCircle className="w-4 h-4"/>
                                    Verified
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg text-slate-200 border-b border-slate-700 pb-2">Classification Details</h3>
                        <div className="space-y-2 text-sm">
                            <p><strong>Primary Morph:</strong> <Badge>{morphDisplayName}</Badge></p>
                            {image.secondary_morph && <p><strong>Secondary Morph:</strong> <Badge variant="secondary">{image.secondary_morph.replace(/_/g, ' ')}</Badge></p>}
                            <p><strong>Base Color:</strong> <Badge variant="outline" className="border-slate-500">{image.base_color?.replace(/_/g, ' ')}</Badge></p>
                            
                            {image.secondary_traits && image.secondary_traits.length > 0 && (
                                <div>
                                    <strong>Traits:</strong>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {image.secondary_traits.map(trait => <Badge key={trait} variant="secondary">{trait.replace(/_/g, ' ')}</Badge>)}
                                    </div>
                                </div>
                            )}
                            
                            <p><strong>Age:</strong> <Badge variant="outline" className="border-slate-500">{image.age_estimate?.replace(/_/g, ' ')}</Badge></p>
                            <p><strong>Fired State:</strong> <Badge variant="outline" className="border-slate-500">{image.fired_state?.replace(/_/g, ' ')}</Badge></p>
                        </div>
                        
                        {image.notes && (
                            <div>
                                <h4 className="font-semibold text-md text-slate-300">Uploader Notes</h4>
                                <p className="text-slate-400 text-sm italic mt-1">"{image.notes}"</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}