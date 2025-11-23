import React, { useState, useEffect } from 'react';
import { Egg, BreedingPlan, Gecko, User } from '@/entities/all';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Egg as EggIcon, Search, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Hatchery() {
    const [eggs, setEggs] = useState([]);
    const [filteredEggs, setFilteredEggs] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [filters, setFilters] = useState({
        season: 'all',
        status: 'all',
        search: ''
    });
    
    const [sortBy, setSortBy] = useState('lay_date_desc');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const user = await User.me();
            const [eggsData, plansData, geckosData] = await Promise.all([
                Egg.filter({ created_by: user.email }, '-lay_date'),
                BreedingPlan.filter({ created_by: user.email }),
                Gecko.filter({ created_by: user.email })
            ]);
            
            setEggs(eggsData);
            setBreedingPlans(plansData);
            setGeckos(geckosData);
        } catch (error) {
            console.error("Failed to load hatchery data:", error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        let result = [...eggs];

        // Filter by season
        if (filters.season !== 'all') {
            result = result.filter(egg => {
                const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
                return plan?.breeding_season === filters.season;
            });
        }

        // Filter by status
        if (filters.status !== 'all') {
            result = result.filter(egg => egg.status === filters.status);
        }

        // Search filter
        if (filters.search) {
            result = result.filter(egg => {
                const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
                const sire = geckos.find(g => g.id === plan?.sire_id);
                const dam = geckos.find(g => g.id === plan?.dam_id);
                
                const searchLower = filters.search.toLowerCase();
                return (
                    sire?.name?.toLowerCase().includes(searchLower) ||
                    dam?.name?.toLowerCase().includes(searchLower) ||
                    plan?.breeding_id?.toLowerCase().includes(searchLower)
                );
            });
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'lay_date_desc':
                    return new Date(b.lay_date) - new Date(a.lay_date);
                case 'lay_date_asc':
                    return new Date(a.lay_date) - new Date(b.lay_date);
                case 'hatch_date_desc':
                    return new Date(b.hatch_date_expected) - new Date(a.hatch_date_expected);
                case 'hatch_date_asc':
                    return new Date(a.hatch_date_expected) - new Date(b.hatch_date_expected);
                default:
                    return 0;
            }
        });

        setFilteredEggs(result);
    }, [eggs, filters, sortBy, breedingPlans, geckos]);

    const uniqueSeasons = [...new Set(breedingPlans.map(p => p.breeding_season).filter(Boolean))];

    const getStatusColor = (status) => {
        const colors = {
            'Hatched': 'bg-green-600',
            'Incubating': 'bg-blue-600',
            'Slug': 'bg-red-600',
            'Infertile': 'bg-red-600',
            'Stillbirth': 'bg-gray-600'
        };
        return colors[status] || 'bg-gray-600';
    };

    const handleEggClick = (egg) => {
        if (egg.status === 'Hatched' && egg.gecko_id) {
            // Navigate to lineage page with the hatched gecko auto-selected
            window.location.href = createPageUrl(`Lineage?geckoId=${egg.gecko_id}`);
        } else {
            // Navigate to lineage of parents
            const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
            if (plan?.sire_id) {
                window.location.href = createPageUrl(`Lineage?geckoId=${plan.sire_id}`);
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-700">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search lineage..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="pl-9 bg-slate-800 border-slate-600"
                            />
                        </div>

                        <Select
                            value={filters.season}
                            onValueChange={(value) => setFilters({ ...filters, season: value })}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="All Seasons" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem value="all">All Seasons</SelectItem>
                                {uniqueSeasons.map(season => (
                                    <SelectItem key={season} value={season}>{season}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.status}
                            onValueChange={(value) => setFilters({ ...filters, status: value })}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Incubating">Incubating</SelectItem>
                                <SelectItem value="Hatched">Hatched</SelectItem>
                                <SelectItem value="Slug">Slug</SelectItem>
                                <SelectItem value="Infertile">Infertile</SelectItem>
                                <SelectItem value="Stillbirth">Stillbirth</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem value="lay_date_desc">Lay Date (Newest)</SelectItem>
                                <SelectItem value="lay_date_asc">Lay Date (Oldest)</SelectItem>
                                <SelectItem value="hatch_date_desc">Hatch Date (Latest)</SelectItem>
                                <SelectItem value="hatch_date_asc">Hatch Date (Earliest)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEggs.map(egg => {
                    const plan = breedingPlans.find(p => p.id === egg.breeding_plan_id);
                    const sire = geckos.find(g => g.id === plan?.sire_id);
                    const dam = geckos.find(g => g.id === plan?.dam_id);
                    const hatchedGecko = egg.gecko_id ? geckos.find(g => g.id === egg.gecko_id) : null;

                    return (
                        <Card
                            key={egg.id}
                            className="bg-slate-800 border-slate-700 hover:border-emerald-500 transition-all cursor-pointer"
                            onClick={() => handleEggClick(egg)}
                        >
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <EggIcon className="w-6 h-6 text-emerald-400" />
                                    <Badge className={`${getStatusColor(egg.status)} text-white`}>
                                        {egg.status}
                                    </Badge>
                                </div>

                                <div>
                                    <p className="text-slate-200 font-semibold">
                                        {sire?.name || 'Unknown'} × {dam?.name || 'Unknown'}
                                    </p>
                                    {plan?.breeding_season && (
                                        <p className="text-xs text-slate-400">{plan.breeding_season}</p>
                                    )}
                                </div>

                                <div className="text-sm text-slate-400 space-y-1">
                                    <p>Laid: {format(new Date(egg.lay_date), 'MMM dd, yyyy')}</p>
                                    <p>Expected: {format(new Date(egg.hatch_date_expected), 'MMM dd, yyyy')}</p>
                                    {egg.hatch_date_actual && (
                                        <p className="text-green-400">
                                            Hatched: {format(new Date(egg.hatch_date_actual), 'MMM dd, yyyy')}
                                        </p>
                                    )}
                                </div>

                                {hatchedGecko && (
                                    <div className="pt-2 border-t border-slate-700">
                                        <p className="text-xs text-emerald-400">
                                            → {hatchedGecko.name}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {filteredEggs.length === 0 && (
                <Card className="bg-slate-900 border-slate-700">
                    <CardContent className="text-center py-12">
                        <EggIcon className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                        <p className="text-slate-400">No eggs found matching your filters</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}