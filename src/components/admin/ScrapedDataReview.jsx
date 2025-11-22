import React, { useState, useEffect } from 'react';
import { ScrapedTrainingData, GeckoImage } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    CheckCircle, 
    XCircle, 
    ExternalLink, 
    Eye,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ScrapedDataReview() {
    const [scrapedData, setScrapedData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reviewingId, setReviewingId] = useState(null);

    useEffect(() => {
        loadScrapedData();
    }, []);

    const loadScrapedData = async () => {
        setIsLoading(true);
        try {
            const data = await ScrapedTrainingData.filter({}, '-created_date', 100);
            setScrapedData(data);
        } catch (error) {
            console.error('Failed to load scraped data:', error);
        }
        setIsLoading(false);
    };

    const handleApprove = async (record) => {
        setReviewingId(record.id);
        try {
            const geckoImageData = {
                image_url: record.image_url,
                primary_morph: record.primary_morph,
                secondary_traits: record.secondary_traits || [],
                base_color: record.base_color,
                confidence_score: Math.min(95, Math.max(60, record.confidence_score * 10)),
                notes: `Auto-imported from ${record.source_website}. Original description: ${record.description || 'None'}`,
                verified: true
            };

            const geckoImage = await GeckoImage.create(geckoImageData);

            await ScrapedTrainingData.update(record.id, {
                status: 'approved',
                gecko_image_id: geckoImage.id,
                admin_notes: `Approved and added to training dataset. GeckoImage ID: ${geckoImage.id}`
            });

            loadScrapedData();
        } catch (error) {
            console.error('Failed to approve scraped data:', error);
        }
        setReviewingId(null);
    };

    const handleReject = async (record, reason) => {
        setReviewingId(record.id);
        try {
            await ScrapedTrainingData.update(record.id, {
                status: 'rejected',
                admin_notes: reason || 'Rejected by administrator'
            });
            loadScrapedData();
        } catch (error) {
            console.error('Failed to reject scraped data:', error);
        }
        setReviewingId(null);
    };

    const pendingData = scrapedData.filter(d => d.status === 'pending_review');
    const reviewedData = scrapedData.filter(d => d.status !== 'pending_review');

    if (isLoading) {
        return <div className="text-center py-8 text-slate-400">Loading scraped training data...</div>;
    }

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg font-semibold flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Scraped Training Data Review
                    </CardTitle>
                    <div className="flex gap-3">
                        <Badge variant="outline" className="text-slate-300 border-slate-600 bg-slate-800">
                            {pendingData.length} Pending Review
                        </Badge>
                        <Badge variant="outline" className="text-slate-300 border-slate-600 bg-slate-800">
                            {reviewedData.length} Processed
                        </Badge>
                        <Button variant="outline" size="sm" onClick={loadScrapedData} className="border-slate-600 text-slate-300 hover:bg-slate-800">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh Data
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {pendingData.length === 0 ? (
                    <div className="text-center py-12">
                        <Eye className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg mb-2">No pending scraped data to review</p>
                        <p className="text-slate-500 text-sm">Use the "Scrape Training Data" button above to find new gecko images for the AI training dataset.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <Alert className="border-blue-600 bg-blue-950/20">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-blue-300">
                                <strong>{pendingData.length} images</strong> are waiting for your review. Approve high-quality images with correct classifications to improve the AI model.
                            </AlertDescription>
                        </Alert>

                        <div className="grid gap-6">
                            {pendingData.map((record) => (
                                <Card key={record.id} className="bg-slate-800 border-slate-600">
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                            {/* Image Preview */}
                                            <div className="space-y-3">
                                                <div className="aspect-square rounded-lg overflow-hidden border border-slate-600">
                                                    <img 
                                                        src={record.image_url} 
                                                        alt="Scraped gecko" 
                                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                    <div className="hidden w-full h-full bg-slate-700 flex items-center justify-center text-slate-400 text-sm">
                                                        <AlertTriangle className="w-8 h-8 mb-2" />
                                                        <div>Image failed to load</div>
                                                    </div>
                                                </div>
                                                <a 
                                                    href={record.source_website} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    View Original Source
                                                </a>
                                            </div>

                                            {/* Classification Details */}
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-300 mb-2">Primary Morph Classification</h4>
                                                    <Badge className="bg-indigo-600/20 text-indigo-300 border-indigo-600 text-lg px-3 py-1">
                                                        {record.primary_morph}
                                                    </Badge>
                                                </div>
                                                
                                                {record.secondary_traits && record.secondary_traits.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-slate-300 mb-2">Secondary Traits</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {record.secondary_traits.map((trait, idx) => (
                                                                <Badge key={idx} variant="outline" className="text-xs border-slate-500 text-slate-300">
                                                                    {trait}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {record.base_color && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-slate-300 mb-2">Base Color</h4>
                                                        <Badge className="bg-amber-600/20 text-amber-300 border-amber-600">
                                                            {record.base_color}
                                                        </Badge>
                                                    </div>
                                                )}
                                                
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-300 mb-2">Classification Confidence</h4>
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-slate-700 rounded-full h-2 flex-1">
                                                            <div 
                                                                className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-500" 
                                                                style={{width: `${Math.min(100, record.confidence_score * 10)}%`}}
                                                            ></div>
                                                        </div>
                                                        <span className="text-sm text-slate-400 font-medium">{record.confidence_score}/10</span>
                                                    </div>
                                                </div>

                                                {record.description && (
                                                    <div>
                                                        <h4 className="text-sm font-medium text-slate-300 mb-2">Original Description</h4>
                                                        <div className="bg-slate-700 p-3 rounded-lg">
                                                            <p className="text-xs text-slate-400 leading-relaxed">{record.description}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="text-xs text-slate-500 pt-2 border-t border-slate-600">
                                                    <p>Source: {record.source_website}</p>
                                                    <p>Scraped: {new Date(record.created_date).toLocaleString()}</p>
                                                </div>
                                            </div>

                                            {/* Review Actions */}
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Button
                                                        onClick={() => handleApprove(record)}
                                                        disabled={reviewingId === record.id}
                                                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                        {reviewingId === record.id ? 'Approving...' : 'Approve & Add to Dataset'}
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        onClick={() => handleReject(record, 'Poor image quality or incorrect classification')}
                                                        disabled={reviewingId === record.id}
                                                        className="w-full"
                                                    >
                                                        <XCircle className="w-4 h-4 mr-2" />
                                                        Reject Image
                                                    </Button>
                                                </div>
                                                
                                                <div className="space-y-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleReject(record, 'Duplicate image already in dataset')}
                                                        disabled={reviewingId === record.id}
                                                        className="w-full text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                                                    >
                                                        Reject: Duplicate
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleReject(record, 'Copyright or licensing concern')}
                                                        disabled={reviewingId === record.id}
                                                        className="w-full text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                                                    >
                                                        Reject: Copyright Issue
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleReject(record, 'Incorrect species (not crested gecko)')}
                                                        disabled={reviewingId === record.id}
                                                        className="w-full text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                                                    >
                                                        Reject: Wrong Species
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recently Reviewed Section */}
                {reviewedData.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-slate-700">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Recently Processed ({reviewedData.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reviewedData.slice(0, 12).map((record) => (
                                <Card key={record.id} className="bg-slate-800 border-slate-600">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                src={record.image_url} 
                                                alt="Processed" 
                                                className="w-16 h-16 object-cover rounded border border-slate-600" 
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate">{record.primary_morph}</p>
                                                <p className="text-xs text-slate-400 truncate">{record.source_website}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge 
                                                        className={record.status === 'approved' 
                                                            ? 'bg-green-600/20 text-green-300 border-green-600' 
                                                            : 'bg-red-600/20 text-red-300 border-red-600'
                                                        }
                                                    >
                                                        {record.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}