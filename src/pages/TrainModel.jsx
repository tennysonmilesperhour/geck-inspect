import { useState, useEffect } from 'react';
import { User, GeckoImage, ScrapedTrainingData } from '@/entities/all';
import { InvokeLLM } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Brain,
    Database,
    TrendingUp,
    Eye,
    CheckCircle,
    Loader2,
    BarChart3,
    Zap,
    Target,
    Globe
} from 'lucide-react';
import { recognizeGeckoMorph } from '../functions/recognizeGeckoMorph';
import { getGeckDataTrainingStats } from '@/lib/geckDataClient';

export default function TrainModelPage() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Training data stats
    const [trainingStats, setTrainingStats] = useState({
        totalImages: 0,
        labeledImages: 0,
        morphCategories: 0,
        recentSubmissions: 0
    });

    // Inventory in geck-data (the standalone Market Intelligence project,
    // populated by the Eye in the Sky extension and the external reference
    // importers). Surfaced here so admins can see how much labeled training
    // material is available beyond the local base44 store.
    const [geckDataStats, setGeckDataStats] = useState(null);
    const [geckDataError, setGeckDataError] = useState(null);
    
    // Model testing
    const [testImage, setTestImage] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // LLM-based recognition
    const [llmAnalysis, setLlmAnalysis] = useState('');
    const [isLlmAnalyzing, setIsLlmAnalyzing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                
                if (currentUser && currentUser.role === 'admin') {
                    // Load training statistics
                    const [allImages, scrapedData] = await Promise.all([
                        GeckoImage.list(),
                        ScrapedTrainingData.list()
                    ]);
                    
                    const labeledImages = allImages.filter(img => 
                        img.primary_morph && img.primary_morph.trim() !== ''
                    );
                    
                    const morphs = new Set();
                    allImages.forEach(img => {
                        if (img.primary_morph) morphs.add(img.primary_morph);
                        if (img.secondary_morph) morphs.add(img.secondary_morph);
                    });
                    
                    const recentSubmissions = allImages.filter(img => {
                        const createdDate = new Date(img.created_date);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return createdDate > weekAgo;
                    });

                    setTrainingStats({
                        totalImages: allImages.length + scrapedData.length,
                        labeledImages: labeledImages.length,
                        morphCategories: morphs.size,
                        recentSubmissions: recentSubmissions.length
                    });

                    // Fire and forget; failure here renders an empty card,
                    // not a blocked page. The hook returns its own error
                    // string when the geck-data anon key is missing or the
                    // project is unreachable.
                    getGeckDataTrainingStats().then(({ data, error }) => {
                        if (data) setGeckDataStats(data);
                        if (error) setGeckDataError(error);
                    });
                }
            } catch (_err) {
                setUser(null);
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const handleTestImage = (e) => {
        const file = e.target.files[0];
        if (file) {
            setTestImage(file);
            setTestResult(null);
            setLlmAnalysis('');
        }
    };

    const analyzeWithCurrentModel = async () => {
        if (!testImage) return;
        
        setIsAnalyzing(true);
        try {
            const { data } = await recognizeGeckoMorph({ image: testImage });
            setTestResult(data);
        } catch (error) {
            setTestResult({ error: 'Analysis failed: ' + error.message });
        }
        setIsAnalyzing(false);
    };

    const analyzeWithLLM = async () => {
        if (!testImage) return;
        
        setIsLlmAnalyzing(true);
        try {
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(testImage);
            });

            const analysis = await InvokeLLM({
                prompt: `Analyze this crested gecko image and identify its morphs and traits. Please provide:
                
1. Primary morph (e.g., Harlequin, Pinstripe, Flame, etc.)
2. Secondary traits (e.g., Partial pinstripe, Chevron, etc.)
3. Base color description
4. Pattern intensity (High, Medium, Low)
5. White/cream amount (if visible)
6. Any notable features
7. Confidence level of identification

Please be specific about crested gecko morphs and use standard morph terminology.`,
                file_urls: [base64]
            });
            
            setLlmAnalysis(analysis);
        } catch (error) {
            setLlmAnalysis('LLM analysis failed: ' + error.message);
        }
        setIsLlmAnalyzing(false);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    if (!user || user.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
                <div className="max-w-4xl mx-auto text-center">
                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                        <CardContent className="p-12">
                            <Brain className="w-16 h-16 text-sage-500 mx-auto mb-4" />
                            <h1 className="text-3xl font-bold text-sage-900 mb-4">AI Training Center</h1>
                            <p className="text-sage-600">Administrator access required to view AI model training tools.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const completionPercentage = trainingStats.totalImages > 0 
        ? Math.round((trainingStats.labeledImages / trainingStats.totalImages) * 100) 
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-sage-900 mb-2">AI Training Center</h1>
                    <p className="text-sage-600">Monitor and test gecko morph recognition models</p>
                </div>

                {/* Training Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <Database className="w-8 h-8 text-blue-500" />
                                <div>
                                    <p className="text-sm text-sage-600">Total Images</p>
                                    <p className="text-2xl font-bold text-sage-900">{trainingStats.totalImages.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                                <div>
                                    <p className="text-sm text-sage-600">Labeled Images</p>
                                    <p className="text-2xl font-bold text-sage-900">{trainingStats.labeledImages.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <Target className="w-8 h-8 text-purple-500" />
                                <div>
                                    <p className="text-sm text-sage-600">Morph Categories</p>
                                    <p className="text-2xl font-bold text-sage-900">{trainingStats.morphCategories}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="w-8 h-8 text-emerald-500" />
                                <div>
                                    <p className="text-sm text-sage-600">This Week</p>
                                    <p className="text-2xl font-bold text-sage-900">{trainingStats.recentSubmissions}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* External inventory (geck-data) */}
                <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5" />
                            geck-data inventory (extension + external sources)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {geckDataError && !geckDataStats ? (
                            <p className="text-sm text-red-600">
                                Unable to read geck-data: {geckDataError}
                            </p>
                        ) : !geckDataStats ? (
                            <p className="text-sm text-sage-600">Loading inventory...</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-sage-600">Listing images</p>
                                    <p className="text-xl font-bold text-sage-900">
                                        {geckDataStats.listing_images.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-sage-600">External refs (iNat / wiki)</p>
                                    <p className="text-xl font-bold text-sage-900">
                                        {geckDataStats.external_reference_images.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-sage-600">Morph taxonomy</p>
                                    <p className="text-xl font-bold text-sage-900">
                                        {geckDataStats.morph_taxonomy.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-sage-600">Market listings</p>
                                    <p className="text-xl font-bold text-sage-900">
                                        {geckDataStats.market_listings.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Training Progress */}
                <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            Training Data Quality
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span>Labeled Images Progress</span>
                            <span>{completionPercentage}%</span>
                        </div>
                        <Progress value={completionPercentage} className="h-3" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            <div className="text-center">
                                <Badge variant={completionPercentage > 80 ? "default" : "secondary"}>
                                    Data Quality: {completionPercentage > 80 ? "Excellent" : completionPercentage > 50 ? "Good" : "Needs Improvement"}
                                </Badge>
                            </div>
                            <div className="text-center">
                                <Badge variant={trainingStats.morphCategories > 15 ? "default" : "secondary"}>
                                    Diversity: {trainingStats.morphCategories > 15 ? "High" : "Medium"}
                                </Badge>
                            </div>
                            <div className="text-center">
                                <Badge variant={trainingStats.recentSubmissions > 10 ? "default" : "secondary"}>
                                    Activity: {trainingStats.recentSubmissions > 10 ? "Active" : "Moderate"}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Model Testing */}
                <Tabs defaultValue="current" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="current">Current Model</TabsTrigger>
                        <TabsTrigger value="llm">LLM Recognition</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="current">
                        <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="w-5 h-5" />
                                    Test Current Model
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-sage-700 mb-2">
                                        Upload Test Image
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleTestImage}
                                        className="block w-full text-sm text-sage-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sage-50 file:text-sage-700 hover:file:bg-sage-100"
                                    />
                                </div>

                                {testImage && (
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <img 
                                                src={URL.createObjectURL(testImage)} 
                                                alt="Test gecko" 
                                                className="w-full h-64 object-cover rounded-lg"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Button 
                                                onClick={analyzeWithCurrentModel}
                                                disabled={isAnalyzing}
                                                className="w-full mb-4"
                                            >
                                                {isAnalyzing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                                                Analyze with AI Model
                                            </Button>
                                            
                                            {testResult && (
                                                <div className="bg-sage-50 rounded-lg p-4 text-sm">
                                                    <h4 className="font-semibold mb-2">Analysis Results:</h4>
                                                    {testResult.error ? (
                                                        <p className="text-red-600">{testResult.error}</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <p><strong>Primary Morph:</strong> {testResult.primary_morph || 'Unknown'}</p>
                                                            <p><strong>Confidence:</strong> {testResult.confidence || 'N/A'}%</p>
                                                            <p><strong>Secondary Traits:</strong> {testResult.secondary_traits?.join(', ') || 'None detected'}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="llm">
                        <Card className="bg-white/80 backdrop-blur-sm border-sage-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="w-5 h-5" />
                                    LLM-Based Recognition
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-sage-700 mb-2">
                                        Upload Test Image
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleTestImage}
                                        className="block w-full text-sm text-sage-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sage-50 file:text-sage-700 hover:file:bg-sage-100"
                                    />
                                </div>

                                {testImage && (
                                    <div className="space-y-4">
                                        <img 
                                            src={URL.createObjectURL(testImage)} 
                                            alt="Test gecko" 
                                            className="w-full max-w-md h-64 object-cover rounded-lg mx-auto"
                                        />
                                        
                                        <Button 
                                            onClick={analyzeWithLLM}
                                            disabled={isLlmAnalyzing}
                                            className="w-full"
                                        >
                                            {isLlmAnalyzing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                                            Analyze with LLM Vision
                                        </Button>
                                        
                                        {llmAnalysis && (
                                            <div className="bg-sage-50 rounded-lg p-4">
                                                <h4 className="font-semibold mb-2">LLM Analysis:</h4>
                                                <div className="whitespace-pre-wrap text-sm text-sage-700">
                                                    {llmAnalysis}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}