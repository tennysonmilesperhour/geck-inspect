import React, { useState, useEffect } from 'react';
import { Gecko, User, WeightRecord } from '@/entities/all';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { Loader2, ArrowLeft, Edit, Trash2, Calendar, LineChart, Users, GitBranch, Info, StickyNote, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GeckoForm from '../components/my-geckos/GeckoForm';

const DetailItem = ({ icon, label, children }) => (
    <div className="flex items-start">
        <div className="flex-shrink-0 w-8 text-slate-400">{icon}</div>
        <div className="ml-4">
            <dt className="text-sm font-medium text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm text-slate-200">{children || 'N/A'}</dd>
        </div>
    </div>
);

export default function GeckoDetail() {
    const [gecko, setGecko] = useState(null);
    const [sire, setSire] = useState(null);
    const [dam, setDam] = useState(null);
    const [userGeckos, setUserGeckos] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const navigate = useNavigate();
    
    const urlParams = new URLSearchParams(window.location.search);
    const geckoId = urlParams.get('id');

    const loadData = async () => {
        if (!geckoId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [fetchedGecko, user, allGeckos] = await Promise.all([
                Gecko.get(geckoId),
                User.me(),
                Gecko.list()
            ]);
            
            setGecko(fetchedGecko);
            setCurrentUser(user);
            setUserGeckos(allGeckos);

            if (fetchedGecko.sire_id) {
                setSire(await Gecko.get(fetchedGecko.sire_id));
            }
            if (fetchedGecko.dam_id) {
                setDam(await Gecko.get(fetchedGecko.dam_id));
            }

        } catch (error) {
            console.error("Failed to load gecko details:", error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [geckoId]);

    const handleFormSave = () => {
        setIsFormOpen(false);
        loadData(); // Reload data to show changes
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this gecko?')) {
            try {
                await Gecko.delete(id);
                navigate(createPageUrl('MyGeckos'));
            } catch (error) {
                console.error("Failed to delete gecko:", error);
            }
        }
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-slate-950"><Loader2 className="w-16 h-16 animate-spin text-emerald-500" /></div>;
    }

    if (!gecko) {
        return <div className="text-center text-slate-400 p-8">Gecko not found.</div>;
    }

    const statusColors = {
        "Ready to Breed": "bg-teal-100 text-teal-700", "Proven": "bg-emerald-100 text-emerald-700", "Holdback": "bg-blue-100 text-blue-700",
        "For Sale": "bg-yellow-100 text-yellow-700", "Sold": "bg-gray-100 text-gray-700", "Pet": "bg-purple-100 text-purple-700",
        "Future Breeder": "bg-indigo-100 text-indigo-700"
    };
    
    const canEdit = currentUser && gecko.created_by === currentUser.email;

    return (
        <div className="bg-slate-950 min-h-screen text-slate-200">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <Button variant="outline" onClick={() => navigate(createPageUrl('MyGeckos'))} className="border-slate-600 hover:bg-slate-800">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Collection
                    </Button>
                    {canEdit && (
                         <Button onClick={() => setIsFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Gecko Details
                        </Button>
                    )}
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <Card className="bg-slate-900 border-slate-700">
                             <div className="aspect-square w-full rounded-t-lg overflow-hidden bg-slate-800">
                                {gecko.image_urls && gecko.image_urls.length > 0 ? (
                                    <img src={gecko.image_urls[0]} alt={gecko.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Users className="w-24 h-24 text-slate-600" />
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-6 text-center">
                                <h1 className="text-3xl font-bold text-slate-100">{gecko.name}</h1>
                                <p className="text-slate-400">{gecko.gecko_id_code}</p>
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                     <Badge className={statusColors[gecko.status] || "bg-gray-100 text-gray-700"}>{gecko.status}</Badge>
                                     <Badge variant="secondary">{gecko.sex}</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                         <Card className="bg-slate-900 border-slate-700">
                            <CardHeader>
                                <CardTitle>Gecko Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <dl className="space-y-6">
                                    <DetailItem icon={<Info className="w-5 h-5"/>} label="Morphs & Traits">
                                        {gecko.morphs_traits}
                                    </DetailItem>
                                     <DetailItem icon={<Calendar className="w-5 h-5"/>} label="Hatch Date">
                                        {gecko.hatch_date ? format(new Date(gecko.hatch_date), 'MMMM d, yyyy') : 'N/A'}
                                    </DetailItem>
                                    <DetailItem icon={<Users className="w-5 h-5"/>} label="Genetics">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <span className="text-xs text-slate-500">Sire</span>
                                                <p>{sire ? sire.name : 'Unknown'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-slate-500">Dam</span>
                                                <p>{dam ? dam.name : 'Unknown'}</p>
                                            </div>
                                        </div>
                                    </DetailItem>
                                    {gecko.asking_price && (
                                        <DetailItem icon={<DollarSign className="w-5 h-5"/>} label="Asking Price">
                                            ${gecko.asking_price}
                                        </DetailItem>
                                    )}
                                     <DetailItem icon={<StickyNote className="w-5 h-5"/>} label="Notes">
                                        {gecko.notes || 'No notes provided.'}
                                    </DetailItem>
                                </dl>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {canEdit && (
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-2xl p-0">
                        <DialogHeader className="p-6 pb-0">
                            <DialogTitle>Edit Gecko</DialogTitle>
                        </DialogHeader>
                        <GeckoForm
                            geckoToEdit={gecko}
                            userGeckos={userGeckos}
                            currentUser={currentUser}
                            onSave={handleFormSave}
                            onCancel={() => setIsFormOpen(false)}
                            onDelete={handleDelete}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}