import React, { useState, useEffect } from 'react';
import { User, GeckoImage } from '@/entities/all';
import { InvokeLLM, UploadFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ManualClassification from '../components/training/ManualClassification';
import { 
    Brain, 
    Database, 
    TrendingUp, 
    Eye, 
    Upload, 
    CheckCircle, 
    AlertTriangle,
    Loader2,
    BarChart3,
    Zap,
    Target
} from 'lucide-react';

export default function TrainingPage() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Updated training data stats to track verified images
    const [trainingStats, setTrainingStats] = useState({
        totalImages: 0,
        verifiedImages: 0, // Changed from labeledImages
        morphCategories: 0,
        recentSubmissions: 0
    });
    
    // Model testing
    const [testImage, setTestImage] = useState(null);
    const [testResult, setTestResult] = useState(null); // This state is currently unused in the provided code logic.
    const [isAnalyzing, setIsAnalyzing] = useState(false); // This state is currently unused in the provided code logic.
    
    // LLM-based recognition
    const [llmAnalysis, setLlmAnalysis] = useState('');
    const [isLlmAnalyzing, setIsLlmAnalyzing] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await User.me().catch(() => null); // Handle potential errors or no user logged in
                setUser(currentUser);
                
                // Load real data from the database
                const [allImages] = await Promise.all([
                    GeckoImage.list().catch(() => []) // Fetch all images, default to empty array on error
                ]);
                
                // Calculate real statistics
                const verifiedImages = allImages.filter(img => img.verified === true);
                
                const morphs = new Set();
                allImages.forEach(img => {
                    if (img.primary_morph) morphs.add(img.primary_morph);
                    if (img.secondary_morph) morphs.add(img.secondary_morph);
                });
                
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                const recentImages = allImages.filter(img => {
                    const createdDate = new Date(img.created_date);
                    return createdDate > oneWeekAgo;
                });

                setTrainingStats({
                    totalImages: allImages.length,
                    verifiedImages: verifiedImages.length,
                    morphCategories: morphs.size,
                    recentSubmissions: recentImages.length
                });

            } catch (error) {
                console.error("Failed to load training data:", error);
                setUser(null); // Ensure user is null if data loading fails
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

    const analyzeWithLLM = async () => {
        if (!testImage) return;
        
        setIsLlmAnalyzing(true);
        try {
            const { file_url } = await UploadFile({ file: testImage });
            const analysis = await InvokeLLM({
                prompt: `Analyze this crested gecko image and identify its morphs and traits using standard crested gecko terminology. Provide:
                1. Primary morph
                2. Secondary traits
                3. Base color description
                4. Pattern intensity
                5. Confidence level (1-100%)`,
                file_urls: [file_url],
                response_json_schema: {
                    type: "object",
                    properties: {
                        primary_morph: { type: "string" },
                        secondary_traits: { type: "array", items: { type: "string" } },
                        base_color: { type: "string" },
                        pattern_intensity: { type: "string" },
                        confidence: { type: "number" },
                        explanation: { type: "string" }
                    }
                }
            });
            setLlmAnalysis(JSON.stringify(analysis, null, 2));
        } catch (error) {
            setLlmAnalysis(`Error: ${error.message}`);
        }
        setIsLlmAnalyzing(false);
    };

    if (!user && !isLoading) { // Only show login if not loading and user is null
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-8">
                <Brain className="w-16 h-16 mb-4 text-emerald-500" />
                <h2 className="text-2xl font-bold mb-2">AI Training Center</h2>
                <p className="text-slate-400 mb-6 max-w-md text-center">
                    Join the community to contribute to gecko morph recognition training and test our AI models.
                </p>
                <Button onClick={() => User.login()} className="bg-emerald-600 hover:bg-emerald-700">
                    Sign Up / Login
                </Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-8">
                <Loader2 className="w-16 h-16 mb-4 text-emerald-500 animate-spin" />
                <h2 className="text-2xl font-bold">Loading AI Training Center...</h2>
                <p className="text-slate-400">Fetching the latest stats.</p>
            </div>
        );
    }

    const trainingGoal = 10000; // Updated target for model training

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-slate-100">AI Training Center</h1>
                            <p className="text-slate-400">Train and test gecko morph recognition models</p>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="stats" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                        <TabsTrigger value="stats" className="data-[state=active]:bg-slate-700">Training Stats</TabsTrigger>
                        <TabsTrigger value="test" className="data-[state=active]:bg-slate-700">Test Model</TabsTrigger>
                        <TabsTrigger value="contribute" className="data-[state=active]:bg-slate-700">Contribute</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stats" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-400">Total Images</p>
                                            <p className="text-3xl font-bold text-slate-100 mt-2">{trainingStats.totalImages.toLocaleString()}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
                                            <Database className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-400">Verified Images</p> {/* Changed from Labeled Images */}
                                            <p className="text-3xl font-bold text-slate-100 mt-2">{trainingStats.verifiedImages.toLocaleString()}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 shadow-lg">
                                            <CheckCircle className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-400">Morph Categories</p>
                                            <p className="text-3xl font-bold text-slate-100 mt-2">{trainingStats.morphCategories}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg">
                                            <Target className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-slate-400">This Week</p>
                                            <p className="text-3xl font-bold text-slate-100 mt-2">{trainingStats.recentSubmissions}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-pink-600 to-red-600 shadow-lg">
                                            <TrendingUp className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-slate-900 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-slate-100 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5" />
                                    Training Progress
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-300">Data Labeling Progress</span>
                                        <span className="text-sm text-slate-400">
                                            {trainingStats.totalImages > 0 ? Math.round((trainingStats.verifiedImages / trainingStats.totalImages) * 100) : 0}%
                                        </span>
                                    </div>
                                    <Progress 
                                        value={trainingStats.totalImages > 0 ? (trainingStats.verifiedImages / trainingStats.totalImages) * 100 : 0} 
                                        className="h-3"
                                        colorClassName="bg-gradient-to-r from-emerald-500 to-blue-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-300">Model Training Goal</span>
                                        <span className="text-sm text-slate-400">
                                            {trainingStats.totalImages > 0 ? Math.round((trainingStats.totalImages / trainingGoal) * 100) : 0}%
                                        </span>
                                    </div>
                                    <Progress 
                                        value={trainingStats.totalImages > 0 ? (trainingStats.totalImages / trainingGoal) * 100 : 0} 
                                        className="h-3"
                                        colorClassName="bg-gradient-to-r from-purple-500 to-pink-500"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">
                                        {trainingStats.totalImages.toLocaleString()} / {trainingGoal.toLocaleString()} images collected
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="test" className="space-y-6">
                        <Card className="bg-slate-900 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-slate-100 flex items-center gap-2">
                                    <Eye className="w-5 h-5" />
                                    Test AI Recognition
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Upload a gecko image to test our recognition model
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleTestImage}
                                        className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                    />
                                </div>

                                {testImage && (
                                    <div className="mt-4">
                                        <img 
                                            src={URL.createObjectURL(testImage)} 
                                            alt="Test gecko" 
                                            className="max-w-md max-h-64 object-cover rounded-lg"
                                        />
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <Button
                                        onClick={analyzeWithLLM}
                                        disabled={!testImage || isLlmAnalyzing}
                                        className=""
                                    >
                                        {isLlmAnalyzing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Analyzing with AI...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-4 h-4 mr-2" />
                                                Analyze with AI
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {llmAnalysis && (
                                    <div className="mt-4 p-4 bg-slate-800 rounded-lg">
                                        <h4 className="text-slate-200 font-semibold mb-2">AI Analysis Result:</h4>
                                        <pre className="text-slate-300 text-sm whitespace-pre-wrap">{llmAnalysis}</pre>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="contribute" className="space-y-6">
                        <ManualClassification />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}