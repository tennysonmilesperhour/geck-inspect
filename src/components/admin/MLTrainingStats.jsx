import React, { useState, useEffect } from 'react';
import { GeckoImage, ScrapedTrainingData } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
    BarChart2, 
    Target, 
    CheckCircle,
    Database,
    TrendingUp
} from 'lucide-react';

export default function MLTrainingStats() {
    const [stats, setStats] = useState({
        totalImages: 0,
        verifiedImages: 0,
        scrapedPending: 0,
        scrapedApproved: 0,
        morphDistribution: {},
        qualityScore: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setIsLoading(true);
        try {
            const [geckoImages, scrapedData] = await Promise.all([
                GeckoImage.list(),
                ScrapedTrainingData.list()
            ]);

            const morphCounts = geckoImages.reduce((acc, img) => {
                acc[img.primary_morph] = (acc[img.primary_morph] || 0) + 1;
                return acc;
            }, {});

            const verifiedCount = geckoImages.filter(img => img.verified).length;
            const pendingScraped = scrapedData.filter(d => d.status === 'pending_review').length;
            const approvedScraped = scrapedData.filter(d => d.status === 'approved').length;

            // Calculate quality score based on verification rate and morph diversity
            const verificationRate = geckoImages.length > 0 ? (verifiedCount / geckoImages.length) * 100 : 0;
            const morphDiversity = Object.keys(morphCounts).length;
            const qualityScore = Math.round((verificationRate * 0.6) + (Math.min(morphDiversity / 20, 1) * 40));

            setStats({
                totalImages: geckoImages.length,
                verifiedImages: verifiedCount,
                scrapedPending: pendingScraped,
                scrapedApproved: approvedScraped,
                morphDistribution: morphCounts,
                qualityScore
            });
        } catch (error) {
            console.error('Failed to load training stats:', error);
        }
        setIsLoading(false);
    };

    if (isLoading) {
        return <div className="text-center py-8">Loading training statistics...</div>;
    }

    const topMorphs = Object.entries(stats.morphDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <Database className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold text-sage-900">{stats.totalImages}</div>
                        <div className="text-sm text-sage-600">Total Images</div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-4 text-center">
                        <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />
                        <div className="text-2xl font-bold text-sage-900">{stats.verifiedImages}</div>
                        <div className="text-sm text-sage-600">Verified</div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-4 text-center">
                        <Target className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                        <div className="text-2xl font-bold text-sage-900">{stats.scrapedPending}</div>
                        <div className="text-sm text-sage-600">Pending Review</div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-4 text-center">
                        <TrendingUp className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                        <div className="text-2xl font-bold text-sage-900">{stats.qualityScore}%</div>
                        <div className="text-sm text-sage-600">Quality Score</div>
                    </CardContent>
                </Card>
            </div>

            {/* Training Progress */}
            <Card>
                <CardHeader>
                    <CardTitle>Training Dataset Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span>Verification Rate</span>
                            <span>{stats.totalImages > 0 ? Math.round((stats.verifiedImages / stats.totalImages) * 100) : 0}%</span>
                        </div>
                        <Progress value={stats.totalImages > 0 ? (stats.verifiedImages / stats.totalImages) * 100 : 0} />
                    </div>

                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span>Dataset Size Goal</span>
                            <span>{stats.totalImages} / 1000</span>
                        </div>
                        <Progress value={Math.min((stats.totalImages / 1000) * 100, 100)} />
                    </div>
                </CardContent>
            </Card>

            {/* Morph Distribution */}
            <Card>
                <CardHeader>
                    <CardTitle>Morph Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {topMorphs.map(([morph, count]) => (
                            <div key={morph} className="text-center p-3 bg-sage-50 rounded-lg">
                                <div className="text-lg font-bold text-sage-900">{count}</div>
                                <div className="text-xs text-sage-600 capitalize">
                                    {morph.replace(/_/g, ' ')}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}