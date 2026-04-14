import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GeckoOfTheDay({ geckoOfTheDay, fallbackGecko = null, onImageSelect }) {
    // Use official gecko of the day if available, otherwise use fallback
    const displayGecko = geckoOfTheDay || fallbackGecko;
    
    if (!displayGecko) {
        return (
            <Card className="gecko-card shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-200">
                        <Star className="w-5 h-5 text-yellow-500" />
                        Featured Gecko
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-slate-400">
                        <p>No gecko images available to feature yet.</p>
                        <p className="text-sm mt-2">Upload some gecko photos to see them featured here!</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const { appreciative_message, date, image, uploader } = displayGecko;
    const isOfficial = !!geckoOfTheDay;

    const handleSelect = () => {
        if (onImageSelect) {
            onImageSelect(image, uploader);
        }
    };

    return (
        <Card className="gecko-card shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-200">
                    <Star className="w-5 h-5 text-yellow-500" />
                    {isOfficial ? 'Gecko of the Day' : 'Featured Gecko'}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div onClick={handleSelect} className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group">
                    <img 
                        src={image.image_url} 
                        alt={isOfficial ? "Gecko of the day" : "Featured gecko"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="text-xl font-bold drop-shadow-lg">{image.primary_morph.replace(/_/g, ' ')}</h3>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <p className="text-slate-300 leading-relaxed italic">
                        {appreciative_message || 'A beautiful example of this morph - check out those amazing colors and patterns!'}
                    </p>
                    
                    {uploader && (
                        <p className="text-sm text-slate-400">
                            Shared by{' '}
                            <Link 
                                to={createPageUrl(`PublicProfile?userId=${uploader.id}`)}
                                className="font-medium text-emerald-400 hover:underline"
                            >
                                {uploader.full_name || uploader.email}
                            </Link>
                        </p>
                    )}
                    
                    {isOfficial && date && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="w-4 h-4" />
                            <span>Featured on {format(new Date(date), 'MMMM d, yyyy')}</span>
                        </div>
                    )}
                    
                    {!isOfficial && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Star className="w-4 h-4" />
                            <span>Community highlight</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}