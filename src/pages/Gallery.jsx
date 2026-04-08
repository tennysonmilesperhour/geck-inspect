import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import GalleryFilters from '../components/gallery/GalleryFilters';
import ImageCard from '../components/gallery/ImageCard';
import ImageDetailModal from '../components/gallery/ImageDetailModal';
import { ImageOff, Loader2 } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { Button } from '@/components/ui/button';

const BATCH_SIZE = 24;

export default function Gallery() {
    const [images, setImages] = useState([]);
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({
        primary_morph: 'all',
        secondary_traits: [],
        base_color: 'all',
        sort: '-created_date'
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

        // Client-side filter secondary_traits (not supported server-side as array contains)
        const filtered = filters.secondary_traits.length > 0
            ? results.filter(img =>
                filters.secondary_traits.every(t => img.secondary_traits?.includes(t))
              )
            : results;

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
    }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-slate-100 mb-2">Image Gallery</h1>
                <p className="text-slate-400 mb-6">Explore user-submitted gecko images. Use the filters to find specific morphs and traits.</p>

                <div className="mb-8">
                    <GalleryFilters filters={filters} onFilterChange={setFilters} />
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <LoadingSpinner />
                    </div>
                ) : images.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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