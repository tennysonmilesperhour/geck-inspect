import { useState, useEffect, useCallback, useRef } from 'react';
import Seo from '@/components/seo/Seo';
import { base44 } from '@/api/base44Client';
import GalleryFilters from '../components/gallery/GalleryFilters';
import ImageCard from '../components/gallery/ImageCard';
import ImageDetailModal from '../components/gallery/ImageDetailModal';
import { ImageOff, Loader2 } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import EmptyState from '../components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BATCH_SIZE = 24;

export default function Gallery() {
    const [galleryPrefs, setGalleryPrefs] = usePageSettings('gallery_prefs', {
        gridColumns: '6',
        defaultSort: '-created_date',
    });
    const [images, setImages] = useState([]);
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({
        primary_morph: 'all',
        secondary_traits: [],
        base_color: 'all',
        sort: galleryPrefs.defaultSort,
    });
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const offsetRef = useRef(0);

    // Build filter query for API
    const buildQuery = useCallback(() => {
        const q = {};
        if (filters.primary_morph !== 'all') q.primary_morph = filters.primary_morph;
        if (filters.base_color !== 'all') q.base_color = filters.base_color;
        return q;
    }, [filters]);

    // Sort string for API
    const sortField = filters.sort === '-likes'
        ? '-likes'
        : filters.sort;

    const fetchBatch = useCallback(async (offset = 0, replace = false) => {
         const query = buildQuery();
         const results = await base44.entities.GeckoImage.filter(query, sortField, BATCH_SIZE, offset);

         // Client-side filter: exclude images with empty/missing data and secondary_traits
         const filtered = results.filter(img => 
             img.image_url && // Must have image URL
             img.created_by && // Must have creator
             (!filters.secondary_traits.length > 0 || filters.secondary_traits.every(t => img.secondary_traits?.includes(t)))
         );

        if (replace) {
            setImages(filtered);
        } else {
            setImages(prev => [...prev, ...filtered]);
        }

        setHasMore(results.length === BATCH_SIZE);
        offsetRef.current = offset + results.length;
    }, [buildQuery, sortField, filters.secondary_traits]);

    // Initial load + reload on filter change
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            offsetRef.current = 0;
            await fetchBatch(0, true);
            // Load users once
            if (users.length === 0) {
                const allUsers = await base44.entities.User.list().catch(() => []);
                setUsers(allUsers);
            }
            setIsLoading(false);
        };
        load();
    }, [filters]);  

    const loadMore = async () => {
        setIsLoadingMore(true);
        await fetchBatch(offsetRef.current, false);
        setIsLoadingMore(false);
    };

    const handleImageSelect = (image) => {
        const uploader = users.find(u => u.email === image.created_by);
        setSelectedImageData({ image, uploader });
    };

    const usersMap = new Map(users.map(u => [u.email, u]));

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <Seo
                title="Image Gallery"
                description="Browse stunning crested gecko photos from breeders worldwide. Filter by morph, color, and trait to find your favorite cresties."
                path="/Gallery"
                keywords={['gecko photos', 'crested gecko gallery', 'morph photos', 'reptile images']}
            />
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-100 mb-2">Image Gallery</h1>
                        <p className="text-slate-400">Explore user-submitted gecko images. Use the filters to find specific morphs and traits.</p>
                    </div>
                    <PageSettingsPanel title="Gallery Settings">
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">Grid Columns</Label>
                            <div className="flex gap-1">
                                {['3', '4', '6'].map(cols => (
                                    <button
                                        key={cols}
                                        onClick={() => setGalleryPrefs({ gridColumns: cols })}
                                        className={`px-3 py-1 text-xs rounded ${galleryPrefs.gridColumns === cols ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                                    >
                                        {cols}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">Default Sort</Label>
                            <Select value={galleryPrefs.defaultSort} onValueChange={v => { setGalleryPrefs({ defaultSort: v }); setFilters(f => ({ ...f, sort: v })); }}>
                                <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="-created_date">Newest First</SelectItem>
                                    <SelectItem value="-likes">Most Liked</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </PageSettingsPanel>
                </div>

                <div className="mb-8">
                    <GalleryFilters filters={filters} onFilterChange={setFilters} />
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <LoadingSpinner />
                    </div>
                ) : images.length > 0 ? (
                    <>
                        <div className={`grid grid-cols-2 gap-4 ${galleryPrefs.gridColumns === '3' ? 'md:grid-cols-3' : galleryPrefs.gridColumns === '4' ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'}`}>
                            {images.map(image => (
                                <ImageCard
                                    key={image.id}
                                    image={image}
                                    uploader={usersMap.get(image.created_by)}
                                    onImageSelect={handleImageSelect}
                                    thumbnail
                                />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="flex justify-center mt-8">
                                <Button
                                    onClick={loadMore}
                                    disabled={isLoadingMore}
                                    variant="outline"
                                    className="border-emerald-500 text-emerald-400 hover:bg-emerald-900/50 px-8"
                                >
                                    {isLoadingMore ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                                    ) : (
                                        'Load More Images'
                                    )}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <EmptyState
                        icon={ImageOff}
                        title="No Images Found"
                        message="Try adjusting your filters or check back later."
                    />
                )}

                {selectedImageData && (
                    <ImageDetailModal
                        data={selectedImageData}
                        onClose={() => setSelectedImageData(null)}
                    />
                )}
            </div>
        </div>
    );
}