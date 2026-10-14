import GeckoImage from '@/components/shared/GeckoImage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { publicDisplayName } from '@/lib/publicColumns';

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
                        <p>Quiet day in the gallery so far.</p>
                        <p className="text-sm mt-2">Drop a photo of one of yours and it could land here tomorrow.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    const { date, image, uploader } = displayGecko;
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
                    <GeckoImage
                        src={image.image_url}
                        alt={image.photo_is_illustrative
                            ? 'Illustrative gecko photo, not the demo animal'
                            : isOfficial ? 'Gecko of the day' : 'Featured gecko'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {image.photo_is_illustrative && (
                        <span className="absolute top-3 right-3 z-10 rounded bg-black/85 px-2 py-1 text-xs font-semibold text-amber-100 shadow">
                            Illustrative photo
                        </span>
                    )}
                    <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="text-xl font-bold drop-shadow-lg">
                            {image.primary_morph ? image.primary_morph.replace(/_/g, ' ') : 'Crested Gecko'}
                        </h3>
                    </div>
                </div>
                
                <div className="space-y-3">
                    {uploader && (
                        <p className="text-sm text-slate-400">
                            Shared by{' '}
                            <Link 
                                to={createPageUrl(`PublicProfile?userId=${uploader.id}`)}
                                className="font-medium text-emerald-400 hover:underline"
                            >
                                {publicDisplayName(uploader)}
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
