import React, { useState, useEffect } from 'react';
import { User, Gecko } from '@/entities/all';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, MapPin, Link as LinkIcon } from 'lucide-react';
import GeckoCard from '../components/my-geckos/GeckoCard';

export default function PublicProfile() {
    const location = useLocation();
    const [profileUser, setProfileUser] = useState(null);
    const [userGeckos, setUserGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams(location.search);
                const userId = params.get('userId');

                if (!userId) {
                    setError("No user specified.");
                    setIsLoading(false);
                    return;
                }
                
                const currentUser = await User.me().catch(() => null);
                
                // Using User.filter as a more robust way to fetch the user data
                const users = await User.filter({ id: userId });
                const user = users && users.length > 0 ? users[0] : null;

                // Check if profile is private (unless current user is admin)
                if (!user || (!user.profile_public && currentUser?.role !== 'admin')) {
                     setError("This profile is private or does not exist.");
                     setIsLoading(false);
                     return;
                }
                
                setProfileUser(user);
                
                // Fetch user's public geckos (or all if current user is admin)
                const geckoFilter = currentUser?.role === 'admin' 
                    ? { created_by: user.email }
                    : { created_by: user.email, is_public: true };
                const geckos = await Gecko.filter(geckoFilter);
                setUserGeckos(geckos);

            } catch (err) {
                console.error("Error fetching public profile:", err);
                setError("Could not load profile.");
            }
            setIsLoading(false);
        };

        fetchProfileData();
    }, [location.search]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-slate-950"><Loader2 className="w-16 h-16 text-emerald-500 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-center p-8 bg-slate-950 min-h-screen text-red-400">{error}</div>;
    }

    if (!profileUser) {
        return null;
    }
    
    return (
        <div className="bg-slate-950 min-h-screen">
            <div className="relative h-48 md:h-64 bg-slate-800">
                {profileUser.cover_image_url && (
                    <img src={profileUser.cover_image_url} alt="Cover" className="w-full h-full object-cover"/>
                )}
            </div>
            
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="-mt-12 sm:-mt-16 sm:flex sm:items-end sm:space-x-5 relative z-10">
                    <div className="flex">
                        <img 
                            className="h-24 w-24 rounded-full ring-4 ring-slate-950 sm:h-32 sm:w-32 object-cover" 
                            src={profileUser.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUser.full_name)}&background=84A98C&color=fff`}
                            alt={profileUser.full_name}
                        />
                    </div>
                    <div className="mt-6 sm:flex-1 sm:min-w-0 sm:flex sm:items-center sm:justify-end sm:space-x-6 sm:pb-1">
                        <div className="sm:hidden md:block mt-6 min-w-0 flex-1">
                            <h1 className="text-2xl font-bold text-slate-100 truncate">{profileUser.full_name}</h1>
                            {profileUser.location && (
                                <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                                    <MapPin className="w-4 h-4" />
                                    {profileUser.location}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="block sm:hidden mt-6 min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-slate-100 truncate">{profileUser.full_name}</h1>
                    {profileUser.location && (
                        <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                            <MapPin className="w-4 h-4" />
                            {profileUser.location}
                        </p>
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                    <Card className="bg-slate-900 border-slate-700">
                        <CardHeader><CardTitle className="text-slate-200">About</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-slate-300">{profileUser.bio || 'No bio provided.'}</p>
                            {profileUser.website_url && (
                                <a href={profileUser.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mt-4">
                                    <LinkIcon className="w-4 h-4" />
                                    <span>{profileUser.website_url.replace(/https?:\/\//, '')}</span>
                                </a>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                    <h2 className="text-2xl font-bold text-slate-100 mb-4">Public Collection ({userGeckos.length})</h2>
                    {userGeckos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {userGeckos.map(gecko => (
                                <GeckoCard key={gecko.id} gecko={gecko} onEdit={() => {}} onDelete={() => {}} onCardClick={() => {}} isPublicView={true}/>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-slate-800 rounded-lg">
                            <Users className="w-12 h-12 mx-auto text-slate-500 mb-4"/>
                            <p className="text-slate-400">This user has not made any geckos public yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}