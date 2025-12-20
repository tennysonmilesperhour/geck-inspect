import React, { useState, useEffect } from 'react';
import { Gecko, User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast'; // Import useToast
import {
  Plus,
  Edit,
  ExternalLink,
  DollarSign,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Settings,
  Upload
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { syncWithMorphMarket } from '@/functions/syncWithMorphMarket';
import { syncWithPalmStreet } from '@/functions/syncWithPalmStreet';

export default function MarketplaceSellPage() {
    const [user, setUser] = useState(null);
    const [allGeckos, setAllGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingGecko, setEditingGecko] = useState(null);
    const [formData, setFormData] = useState({
        asking_price: '',
        status: 'For Sale',
        is_public: true,
        morphmarket_url: '',
        palm_street_url: '',
        marketplace_description: ''
    });
    const [syncLoading, setSyncLoading] = useState({});
    const [palmStreetSync, setPalmStreetSync] = useState(false);
    const [morphMarketSync, setMorphMarketSync] = useState(false);
    const { toast } = useToast(); // Initialize useToast

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                if (currentUser) {
                    setUser(currentUser);
                    setPalmStreetSync(currentUser.palm_street_sync_enabled || false);
                    setMorphMarketSync(currentUser.morphmarket_sync_enabled || false);
                    
                    const userGeckos = await Gecko.filter({ created_by: currentUser.email }, '-created_date');
                    setAllGeckos(userGeckos);
                }
            } catch (error) {
                console.error('Failed to load data:', error);
            }
            setIsLoading(false);
        };
        loadInitialData();
    }, []);

    const handleEdit = (gecko) => {
        setEditingGecko(gecko);
        setFormData({
            asking_price: gecko.asking_price || '',
            status: gecko.status || 'Pet',
            is_public: gecko.is_public !== false,
            morphmarket_url: gecko.morphmarket_url || '',
            palm_street_url: gecko.palm_street_url || '',
            marketplace_description: gecko.marketplace_description || gecko.notes || ''
        });
    };

    const handleSave = async () => {
        if (!editingGecko) return;

        try {
            const updatedGeckoData = {
                ...editingGecko, // Spread existing gecko data to ensure all fields are present
                ...formData,
                asking_price: formData.asking_price ? parseFloat(formData.asking_price) : null
            };
            
            await Gecko.update(editingGecko.id, updatedGeckoData);

            // Update local state
            setAllGeckos(prev => prev.map(g =>
                g.id === editingGecko.id ? { ...g, ...formData, asking_price: formData.asking_price ? parseFloat(formData.asking_price) : null } : g
            ));

            setEditingGecko(null);
            toast({
                title: "Success",
                description: "Gecko listing updated successfully.",
            });
        } catch (error) {
            console.error('Failed to update gecko:', error);
            toast({
                title: "Error",
                description: "Failed to update gecko listing.",
                variant: "destructive",
            });
        }
    };

    const handleSync = async (geckoId, platform) => {
        setSyncLoading(prev => ({ ...prev, [`${geckoId}-${platform}`]: true }));
        
        try {
            if (platform === 'morphmarket') {
                const response = await syncWithMorphMarket({ geckoId, action: 'list' });
                if (response.data.success) {
                    // Update gecko with MorphMarket ID
                    await Gecko.update(geckoId, { morphmarket_id: response.data.morphMarketId, morphmarket_url: response.data.listingUrl });
                    setAllGeckos(prev => prev.map(g => 
                        g.id === geckoId ? { ...g, morphmarket_id: response.data.morphMarketId, morphmarket_url: response.data.listingUrl } : g
                    ));
                    toast({
                        title: "Success",
                        description: `Gecko synced with MorphMarket.`,
                    });
                } else {
                    throw new Error(response.data.message || 'Unknown error during MorphMarket sync.');
                }
            } else if (platform === 'palmstreet') {
                const response = await syncWithPalmStreet({ geckoId, action: 'list' });
                if (response.data.success) {
                    // Update gecko with Palm Street ID
                    await Gecko.update(geckoId, { palm_street_id: response.data.palmStreetId, palm_street_url: response.data.listingUrl });
                     setAllGeckos(prev => prev.map(g => 
                        g.id === geckoId ? { ...g, palm_street_id: response.data.palmStreetId, palm_street_url: response.data.listingUrl } : g
                    ));
                    toast({
                        title: "Success",
                        description: `Gecko synced with Palm Street.`,
                    });
                } else {
                    throw new Error(response.data.message || 'Unknown error during Palm Street sync.');
                }
            }
        } catch (error) {
            console.error(`Failed to sync with ${platform}:`, error);
            toast({
                title: "Error",
                description: `Failed to sync with ${platform}: ${error.message || 'Please try again.'}`,
                variant: "destructive",
            });
        } finally {
            setSyncLoading(prev => ({ ...prev, [`${geckoId}-${platform}`]: false }));
        }
    };

    const handlePalmStreetSyncToggle = async (checked) => {
        setPalmStreetSync(checked);
        try {
            if (user) {
                await User.updateMyUserData({ palm_street_sync_enabled: checked });
                setUser(prev => prev ? ({ ...prev, palm_street_sync_enabled: checked }) : null);
                toast({
                    title: "Success",
                    description: `Palm Street sync ${checked ? 'enabled' : 'disabled'}.`,
                });
            }
        } catch (error) {
            console.error("Failed to update PalmStreet sync preference", error);
            setPalmStreetSync(!checked); // Revert on error
            toast({
                title: "Error",
                description: "Failed to update Palm Street sync preference.",
                variant: "destructive",
            });
        }
    };
    
    const handleMorphMarketSyncToggle = async (checked) => {
        setMorphMarketSync(checked);
        try {
            if (user) {
                await User.updateMyUserData({ morphmarket_sync_enabled: checked });
                setUser(prev => prev ? ({ ...prev, morphmarket_sync_enabled: checked }) : null);
                toast({
                    title: "Success",
                    description: `MorphMarket sync ${checked ? 'enabled' : 'disabled'}.`,
                });
            }
        } catch (error) {
            console.error("Failed to update MorphMarket sync preference", error);
            setMorphMarketSync(!checked); // Revert on error
            toast({
                title: "Error",
                description: "Failed to update MorphMarket sync preference.",
                variant: "destructive",
            });
        }
    };

    const handleUpdateUser = async (field, value) => {
        if (!user) return;
        try {
            await User.updateMyUserData({ [field]: value });
            const updatedUser = {...user, [field]: value};
            setUser(updatedUser);
            toast({
                title: "Success",
                description: "Profile information saved successfully.",
            });
        } catch (error) {
            console.error(`Failed to update user ${field}:`, error);
            toast({
                title: "Error",
                description: "Failed to save profile information.",
                variant: "destructive",
            });
        }
    };

    const updateGeckoStatus = async (geckoId, newStatus) => {
        try {
            const updateData = { status: newStatus };
            
            // If marking as sold, also archive the gecko
            if (newStatus === 'Sold') {
                updateData.archived = true;
                updateData.archived_date = new Date().toISOString().split('T')[0];
            }
            
            await Gecko.update(geckoId, updateData);
            setAllGeckos(prev => prev.map(g => g.id === geckoId ? { ...g, ...updateData } : g));
            toast({
                title: "Success",
                description: newStatus === 'Sold' 
                    ? "Gecko marked as sold and moved to archive" 
                    : `Gecko status updated to "${newStatus}".`,
            });
        } catch (error) {
            console.error("Failed to update gecko status:", error);
            toast({
                title: "Error",
                description: "Failed to update gecko status.",
                variant: "destructive",
            });
        }
    };

    const forSaleGeckos = allGeckos.filter(g => g.status === 'For Sale' && !g.archived);
    const soldGeckos = allGeckos.filter(g => g.status === 'Sold');
    const availableGeckos = allGeckos.filter(g => g.status !== 'For Sale' && g.status !== 'Sold' && !g.archived);

    const GeckoListingCard = ({ gecko, onEdit, onUpdateStatus }) => {
        const primaryImage = gecko.image_urls && gecko.image_urls.length > 0 ? gecko.image_urls[0] : null;

        return (
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                <div className="relative">
                    {primaryImage ? (
                        <img 
                            src={primaryImage} 
                            alt={gecko.name}
                            className="w-full h-32 object-cover rounded-t-lg"
                        />
                    ) : (
                        <div className="w-full h-32 bg-gradient-to-br from-sage-100 to-earth-100 flex items-center justify-center rounded-t-lg">
                            <Upload className="w-8 h-8 text-sage-400" />
                        </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                        <Badge className={`text-xs ${
                            gecko.status === 'For Sale' ? 'bg-green-100 text-green-800' :
                            gecko.status === 'Sold' ? 'bg-gray-100 text-gray-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>
                            {gecko.status}
                        </Badge>
                        {!gecko.is_public && (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                                <EyeOff className="w-3 h-3" />
                            </Badge>
                        )}
                    </div>
                </div>

                <CardContent className="p-4">
                    <div className="space-y-3">
                        <div>
                            <h3 className="font-bold text-sage-900">{gecko.name}</h3>
                            {gecko.morphs_traits && (
                                <p className="text-sm text-sage-600">{gecko.morphs_traits}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                                gecko.sex === 'Male' ? 'bg-blue-100 text-blue-700' : 
                                gecko.sex === 'Female' ? 'bg-pink-100 text-pink-700' : 
                                'bg-gray-100 text-gray-700'
                            }`}>
                                {gecko.sex}
                            </span>
                            {gecko.asking_price && (
                                <div className="flex items-center gap-1 font-semibold text-green-600">
                                    <DollarSign className="w-3 h-3" />
                                    <span>{gecko.asking_price}</span>
                                </div>
                            )}
                        </div>

                        {/* External Platform Status */}
                        {(gecko.morphmarket_url || gecko.palm_street_url) && (
                            <div className="flex gap-2">
                                {gecko.morphmarket_url && (
                                    <Badge className="bg-orange-100 text-orange-800 text-xs">
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        MorphMarket
                                    </Badge>
                                )}
                                {gecko.palm_street_url && (
                                    <Badge className="bg-purple-100 text-purple-800 text-xs">
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        Palm Street
                                    </Badge>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-2 pt-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onEdit(gecko)}
                            >
                                <Edit className="w-3 h-3 mr-1" />
                                Edit Listing Details
                            </Button>
                            {gecko.status === 'For Sale' ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(gecko.id, 'Sold')}
                                    className="bg-green-50 text-green-700 hover:bg-green-100"
                                >
                                    Mark as Sold
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(gecko.id, 'For Sale')}
                                    className="bg-green-50 text-green-700 hover:bg-green-100"
                                >
                                    List For Sale
                                </Button>
                            )}
                            <Link to={createPageUrl(`GeckoDetail?id=${gecko.id}`)}>
                                <Button variant="outline" size="sm" className="w-full">
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Gecko Profile
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="min-h-screen bg-sage-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-sage-900 dark:text-sage-100 mb-2">Sell Geckos</h1>
                    <p className="text-sage-600 dark:text-sage-300">Manage your gecko listings and marketplace presence</p>
                </div>

                {/* Marketplace Sync Settings */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <RefreshCw className="w-5 h-5" />
                            Marketplace Sync
                        </CardTitle>
                        <CardDescription>Automatically list your geckos on other platforms.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label htmlFor="palmstreet-sync" className="flex flex-col">
                                <span>Sync with Palm Street</span>
                                <span className="text-xs text-sage-500">Coming soon!</span>
                            </Label>
                            <Switch id="palmstreet-sync" checked={palmStreetSync} onCheckedChange={handlePalmStreetSyncToggle} disabled />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <Label htmlFor="morphmarket-sync" className="flex flex-col">
                                <span>Sync with MorphMarket</span>
                                <span className="text-xs text-sage-500">Requires MorphMarket API key in settings. Coming Soon!</span>
                            </Label>
                            <Switch id="morphmarket-sync" checked={morphMarketSync} onCheckedChange={handleMorphMarketSyncToggle} disabled />
                        </div>
                    </CardContent>
                </Card>

                {/* Marketplace Profile Settings */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Marketplace Profile
                        </CardTitle>
                        <CardDescription>Your public profile information for buyers.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="breeder-name">Breeder/Business Name</Label>
                            <Input
                                id="breeder-name"
                                value={user?.breeder_name || ''}
                                onChange={(e) => setUser(prev => ({...prev, breeder_name: e.target.value}))}
                                onBlur={(e) => handleUpdateUser('breeder_name', e.target.value)}
                                placeholder="Your breeding operation name"
                            />
                        </div>
                        <div>
                            <Label htmlFor="contact-email">Contact Email</Label>
                            <Input
                                id="contact-email"
                                type="email"
                                value={user?.email_contact || ''}
                                onChange={(e) => setUser(prev => ({...prev, email_contact: e.target.value}))}
                                onBlur={(e) => handleUpdateUser('email_contact', e.target.value)}
                                placeholder="Business contact email"
                            />
                        </div>
                        <div>
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                value={user?.location || ''}
                                onChange={(e) => setUser(prev => ({...prev, location: e.target.value}))}
                                onBlur={(e) => handleUpdateUser('location', e.target.value)}
                                placeholder="City, State"
                            />
                        </div>
                        <div>
                            <Label htmlFor="morphmarket-store">MorphMarket Store URL</Label>
                            <Input
                                id="morphmarket-store"
                                value={user?.morphmarket_url || ''}
                                onChange={(e) => setUser(prev => ({...prev, morphmarket_url: e.target.value}))}
                                onBlur={(e) => handleUpdateUser('morphmarket_url', e.target.value)}
                                placeholder="https://morphmarket.com/store/yourstore"
                            />
                        </div>
                        <div>
                            <Label htmlFor="palmstreet-profile">Palm Street Profile URL</Label>
                            <Input
                                id="palmstreet-profile"
                                value={user?.palm_street_url || ''}
                                onChange={(e) => setUser(prev => ({...prev, palm_street_url: e.target.value}))}
                                onBlur={(e) => handleUpdateUser('palm_street_url', e.target.value)}
                                placeholder="https://palmstreetgallery.com/your-profile"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Geckos For Sale */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl">Your Listings ({forSaleGeckos.length})</CardTitle>
                        <CardDescription>Geckos currently listed for sale.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {forSaleGeckos.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {forSaleGeckos.map(gecko => (
                                    <GeckoListingCard key={gecko.id} gecko={gecko} onEdit={handleEdit} onUpdateStatus={updateGeckoStatus} />
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <DollarSign className="w-12 h-12 text-sage-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-sage-900 mb-2">No geckos currently listed for sale</h3>
                                <p className="text-sage-600 mb-4">Mark some of your geckos as "For Sale" to list them here.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sold Geckos */}
                {soldGeckos.length > 0 && (
                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl">Sold Geckos ({soldGeckos.length})</CardTitle>
                            <CardDescription>Geckos that have been sold (archived).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {soldGeckos.map(gecko => (
                                    <GeckoListingCard key={gecko.id} gecko={gecko} onEdit={handleEdit} onUpdateStatus={updateGeckoStatus} />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Geckos Available for Listing */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl">Available to List ({availableGeckos.length})</CardTitle>
                        <CardDescription>Geckos in your collection that are not currently for sale or sold.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {availableGeckos.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {availableGeckos.map(gecko => (
                                    <GeckoListingCard key={gecko.id} gecko={gecko} onEdit={handleEdit} onUpdateStatus={updateGeckoStatus} />
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <Plus className="w-12 h-12 text-sage-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-sage-900 mb-2">No geckos available to list</h3>
                                <p className="text-sage-600 mb-4">Add some geckos to your collection first to list them here.</p>
                                <Link to={createPageUrl('MyGeckos')}>
                                    <Button>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Gecko
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Edit Modal */}
                {editingGecko && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <Card className="bg-white dark:bg-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <CardHeader>
                                <CardTitle className="dark:text-white">Edit {editingGecko.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="asking-price" className="dark:text-sage-200">Asking Price ($)</Label>
                                        <Input
                                            id="asking-price"
                                            type="number"
                                            value={formData.asking_price}
                                            onChange={(e) => setFormData(prev => ({...prev, asking_price: e.target.value}))}
                                            placeholder="0"
                                            className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="status" className="dark:text-sage-200">Status</Label>
                                        <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({...prev, status: value}))}>
                                            <SelectTrigger className="dark:bg-gray-700 dark:text-white dark:border-gray-600">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-gray-700 dark:text-white dark:border-gray-600">
                                                <SelectItem value="Pet">Pet</SelectItem>
                                                <SelectItem value="Future Breeder">Future Breeder</SelectItem>
                                                <SelectItem value="Holdback">Holdback</SelectItem>
                                                <SelectItem value="Ready to Breed">Ready to Breed</SelectItem>
                                                <SelectItem value="Proven">Proven</SelectItem>
                                                <SelectItem value="For Sale">For Sale</SelectItem>
                                                <SelectItem value="Sold">Sold</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="dark:text-sage-200">Public Listing</Label>
                                        <p className="text-sm text-sage-600 dark:text-sage-300">Allow others to see this gecko in the marketplace</p>
                                    </div>
                                    <Switch
                                        checked={formData.is_public}
                                        onCheckedChange={(checked) => setFormData(prev => ({...prev, is_public: checked}))}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="morphmarket-url" className="dark:text-sage-200">MorphMarket Listing URL</Label>
                                    <Input
                                        id="morphmarket-url"
                                        value={formData.morphmarket_url}
                                        onChange={(e) => setFormData(prev => ({...prev, morphmarket_url: e.target.value}))}
                                        placeholder="https://morphmarket.com/store/listing/123456"
                                        className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="palmstreet-url" className="dark:text-sage-200">Palm Street Listing URL</Label>
                                    <Input
                                        id="palmstreet-url"
                                        value={formData.palm_street_url}
                                        onChange={(e) => setFormData(prev => ({...prev, palm_street_url: e.target.value}))}
                                        placeholder="https://palmstreetgallery.com/animal/123456"
                                        className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="marketplace-description" className="dark:text-sage-200">Marketplace Description</Label>
                                    <Textarea
                                        id="marketplace-description"
                                        value={formData.marketplace_description}
                                        onChange={(e) => setFormData(prev => ({...prev, marketplace_description: e.target.value}))}
                                        placeholder="Special description for marketplace listings..."
                                        rows={3}
                                        className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                                    />
                                </div>

                                <div className="flex justify-between gap-4 pt-4">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSync(editingGecko.id, 'morphmarket')}
                                            disabled={syncLoading[`${editingGecko.id}-morphmarket`]}
                                            className="dark:bg-gray-700 dark:text-white dark:border-gray-600 hover:bg-gray-600"
                                        >
                                            <RefreshCw className="w-3 h-3 mr-1" />
                                            {syncLoading[`${editingGecko.id}-morphmarket`] ? 'Syncing...' : 'Sync MM'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSync(editingGecko.id, 'palmstreet')}
                                            disabled={syncLoading[`${editingGecko.id}-palmstreet`]}
                                            className="dark:bg-gray-700 dark:text-white dark:border-gray-600 hover:bg-gray-600"
                                        >
                                            <RefreshCw className="w-3 h-3 mr-1" />
                                            {syncLoading[`${editingGecko.id}-palmstreet`] ? 'Syncing...' : 'Sync PS'}
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setEditingGecko(null)}
                                            className="dark:bg-gray-700 dark:text-white dark:border-gray-600 hover:bg-gray-600"
                                        >
                                            Cancel
                                        </Button>
                                        <Button onClick={handleSave}
                                            className="dark:bg-sage-600 dark:text-white hover:bg-sage-700"
                                        >
                                            <Save className="w-3 h-3 mr-1" />
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}