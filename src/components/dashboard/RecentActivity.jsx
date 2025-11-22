import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Image, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function RecentActivity({ geckoImages, isLoading, onImageSelect, users = [] }) {
    const usersMap = new Map(users.map(u => [u.email, u]));

    return (
        <Card className="gecko-card">
            <CardHeader>
                <CardTitle className="text-gecko-text text-glow flex items-center gap-2">
                    <Image className="w-5 h-5 text-gecko-accent" />
                    Latest AI Training Submissions
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {geckoImages.map(image => {
                            const uploader = usersMap.get(image.created_by);
                            return (
                                <div 
                                    key={image.id}
                                    className="block aspect-square rounded-lg overflow-hidden relative group cursor-pointer"
                                    onClick={() => onImageSelect(image, uploader)}
                                >
                                    <img 
                                        src={image.image_url} 
                                        alt={image.primary_morph} 
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                                        <h4 className="font-bold text-xs capitalize truncate">{image.primary_morph.replace(/_/g, ' ')}</h4>
                                        <p className="text-[10px] opacity-80 truncate">{formatDistanceToNow(new Date(image.created_date), { addSuffix: true })}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}