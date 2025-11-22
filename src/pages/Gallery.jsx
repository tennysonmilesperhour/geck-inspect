import React, { useState, useEffect, useCallback } from 'react';
import { GeckoImage, User } from '@/entities/all';
import GalleryFilters from '../components/gallery/GalleryFilters';
import ImageCard from '../components/gallery/ImageCard';
import ImageDetailModal from '../components/gallery/ImageDetailModal';
import { Loader2, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import _ from 'lodash';

const PAGE_SIZE = 24;

export default function Gallery() {
    const [images, setImages] = useState([]);
    const [users, setUsers] = useState([]);
    const [filteredImages, setFilteredImages] = useState([]);
    const [filters, setFilters] = useState({
        primary_morph: 'all',
        secondary_traits: [],
        base_color: 'all',
        sort: '-created_date'
    });
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [displayedImages, setDisplayedImages] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            try {
                const [allImages, allUsers] = await Promise.all([
                    GeckoImage.list('-created_date'),
                    User.list()
                ]);
                setImages(allImages);
                setUsers(allUsers);
                // Initial filter and display setup
                const sortedImages = _.orderBy(allImages, [img => new Date(img.created_date)], ['desc']);
                setFilteredImages(sortedImages);
                setDisplayedImages(sortedImages.slice(0, PAGE_SIZE));
                setCurrentPage(1);
            } catch (error) {
                console.error("Failed to load initial data:", error);
            }
            setIsLoading(false);
        };
        fetchAllData();
    }, []);

    const applyFilters = useCallback(() => {
        let tempImages = [...images];

        if (filters.primary_morph !== 'all') {
            tempImages = tempImages.filter(img => img.primary_morph === filters.primary_morph);
        }
        if (filters.base_color !== 'all') {
            tempImages = tempImages.filter(img => img.base_color === filters.base_color);
        }
        if (filters.secondary_traits.length > 0) {
            tempImages = tempImages.filter(img =>
                filters.secondary_traits.every(trait => img.secondary_traits?.includes(trait))
            );
        }

        // Apply sorting
        if (filters.sort === '-likes') {
            tempImages = _.orderBy(tempImages, [(img) => img.likes || 0], ['desc']);
        } else {
            tempImages = _.orderBy(tempImages, [img => new Date(img.created_date)], [filters.sort.startsWith('-') ? 'desc' : 'asc']);
        }
        
        setFilteredImages(tempImages);
        setDisplayedImages(tempImages.slice(0, PAGE_SIZE));
        setCurrentPage(1);
    }, [images, filters]);

    useEffect(() => {
        if (!isLoading) {
            applyFilters();
        }
    }, [filters, images, isLoading, applyFilters]);

    const loadMoreImages = () => {
        const nextPage = currentPage + 1;
        const newImages = filteredImages.slice(0, nextPage * PAGE_SIZE);
        setDisplayedImages(newImages);
        setCurrentPage(nextPage);
    };
    
    const handleImageSelect = (image) => {
        const uploader = users.find(u => u.email === image.created_by);
        setSelectedImageData({ image, uploader });
    };

    const hasMoreImages = displayedImages.length < filteredImages.length;
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
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                    </div>
                ) : displayedImages.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {displayedImages.map(image => (
                                <ImageCard 
                                    key={image.id} 
                                    image={image}
                                    uploader={usersMap.get(image.created_by)}
                                    onImageSelect={handleImageSelect}
                                />
                            ))}
                        </div>
                        
                        {hasMoreImages && (
                            <div className="flex justify-center mt-8">
                                <Button 
                                    onClick={loadMoreImages}
                                    variant="outline"
                                    className="border-emerald-500 text-emerald-400 hover:bg-emerald-900/50"
                                >
                                    Load More Images
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20 bg-slate-900 rounded-lg">
                        <ImageOff className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                        <h3 className="text-xl font-semibold text-slate-300">No Images Found</h3>
                        <p className="text-slate-400">Try adjusting your filters or check back later.</p>
                    </div>
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