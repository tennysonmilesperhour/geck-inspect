import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Coffee, Server, Zap, Users, Gift, CreditCard, Calendar } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';

export default function DonationsPage() {
    const handleDonation = (amount, isRecurring = false) => {
        // This would integrate with your payment processor
        console.log(`Processing ${isRecurring ? 'recurring' : 'one-time'} donation of $${amount}`);
        // Example: redirect to Stripe, PayPal, etc.
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                            <Heart className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl font-bold text-sage-900 dark:text-white">Support Geck Inspect</h1>
                    </div>
                    <p className="text-xl text-sage-600 dark:text-sage-300 max-w-3xl mx-auto">
                        Help me keep this platform free and continuously improve it for the crested gecko community.
                    </p>
                </div>

                {/* Mission Statement */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sage-900 dark:text-white">
                            <Users className="w-6 h-6" />
                            My Commitment to You
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-lg text-sage-700 dark:text-sage-300">
                            <p className="mb-4">
                                <strong>Geck Inspect will always be free to use.</strong> This is my promise to the crested gecko community. It's a passion project built in my spare time.
                            </p>
                            <p className="mb-4">
                                I believe that knowledge about these amazing creatures should be accessible to everyone, whether you're a first-time owner or a seasoned breeder. No paywalls, no premium tiers, no hidden costs.
                            </p>
                            <p>
                                Your donations help me cover hosting costs, improve the AI models, and add new features that benefit everyone in our community.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* How Donations Help */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg hover:shadow-xl transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sage-900 dark:text-white">
                                <Server className="w-6 h-6 text-blue-500" />
                                Hosting & Infrastructure
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sage-600 dark:text-sage-300">
                                Keep our servers running fast and reliable, ensuring the app is always available when you need it.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg hover:shadow-xl transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sage-900 dark:text-white">
                                <Zap className="w-6 h-6 text-yellow-500" />
                                AI Model Training
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sage-600 dark:text-sage-300">
                                Improve the accuracy of morph identification and add support for new traits and patterns.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg hover:shadow-xl transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sage-900 dark:text-white">
                                <Gift className="w-6 h-6 text-green-500" />
                                New Features
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sage-600 dark:text-sage-300">
                                Develop new tools like advanced breeding calculators, health tracking, and community features.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Donation Options */}
                <Card className="bg-gradient-to-br from-sage-100 to-earth-100 dark:from-gray-800/50 dark:to-gray-700/50 border-sage-200 dark:border-sage-700 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-center text-sage-900 dark:text-white">
                            Choose Your Support Level
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="one-time" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-8">
                                <TabsTrigger value="one-time" className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    One-Time Donation
                                </TabsTrigger>
                                <TabsTrigger value="recurring" className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Monthly Support
                                </TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="one-time" className="mt-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-xl font-semibold text-sage-900 dark:text-white mb-2">Make a One-Time Contribution</h3>
                                    <p className="text-sage-600 dark:text-sage-300">Every contribution helps me improve the platform</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="text-center p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-all">
                                        <Coffee className="w-12 h-12 mx-auto mb-4 text-amber-600" />
                                        <h3 className="text-xl font-semibold mb-2 text-sage-900 dark:text-white">Buy me a Coffee</h3>
                                        <p className="text-3xl font-bold text-sage-600 dark:text-sage-300 mb-2">$5</p>
                                        <p className="text-sm text-sage-500 dark:text-sage-400 mb-4 h-12">
                                            A small thank you to help keep the lights on.
                                        </p>
                                        <Button 
                                            className="w-full bg-amber-600 hover:bg-amber-700"
                                            onClick={() => handleDonation(5, false)}
                                        >
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            Donate $5 Once
                                        </Button>
                                    </Card>

                                    <Card className="text-center p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-all border-2 border-sage-500 dark:border-sage-400">
                                        <Heart className="w-12 h-12 mx-auto mb-4 text-pink-600" />
                                        <h3 className="text-xl font-semibold mb-2 text-sage-900 dark:text-white">Gecko Enthusiast</h3>
                                        <p className="text-3xl font-bold text-sage-600 dark:text-sage-300 mb-2">$25</p>
                                        <p className="text-sm text-sage-500 dark:text-sage-400 mb-4 h-12">
                                            Fund a month of image hosting or a small feature update.
                                        </p>
                                        <Button 
                                            className="w-full bg-pink-600 hover:bg-pink-700"
                                            onClick={() => handleDonation(25, false)}
                                        >
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            Donate $25 Once
                                        </Button>
                                        <Badge className="mt-2 bg-sage-100 text-sage-800 dark:bg-sage-800 dark:text-sage-200">
                                            Most Popular
                                        </Badge>
                                    </Card>

                                    <Card className="text-center p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-all">
                                        <Zap className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                                        <h3 className="text-xl font-semibold mb-2 text-sage-900 dark:text-white">Community Champion</h3>
                                        <p className="text-3xl font-bold text-sage-600 dark:text-sage-300 mb-2">$50</p>
                                        <p className="text-sm text-sage-500 dark:text-sage-400 mb-4 h-12">
                                            Significantly impact AI training and new tool development.
                                        </p>
                                        <Button 
                                            className="w-full bg-purple-600 hover:bg-purple-700"
                                            onClick={() => handleDonation(50, false)}
                                        >
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            Donate $50 Once
                                        </Button>
                                    </Card>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="recurring" className="mt-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-xl font-semibold text-sage-900 dark:text-white mb-2">Become a Monthly Supporter</h3>
                                    <p className="text-sage-600 dark:text-sage-300">Provide steady support that helps me plan improvements</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="text-center p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-all">
                                        <Coffee className="w-12 h-12 mx-auto mb-4 text-amber-600" />
                                        <h3 className="text-xl font-semibold mb-2 text-sage-900 dark:text-white">Coffee Club</h3>
                                        <p className="text-3xl font-bold text-sage-600 dark:text-sage-300 mb-2">$5<span className="text-base">/month</span></p>
                                        <p className="text-sm text-sage-500 dark:text-sage-400 mb-4 h-12">
                                            Consistent support for daily server costs.
                                        </p>
                                        <Button 
                                            className="w-full bg-amber-600 hover:bg-amber-700"
                                            onClick={() => handleDonation(5, true)}
                                        >
                                            <Calendar className="w-4 h-4 mr-2" />
                                            $5 Monthly
                                        </Button>
                                    </Card>

                                    <Card className="text-center p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-all border-2 border-sage-500 dark:border-sage-400">
                                        <Heart className="w-12 h-12 mx-auto mb-4 text-pink-600" />
                                        <h3 className="text-xl font-semibold mb-2 text-sage-900 dark:text-white">Project Patron</h3>
                                        <p className="text-3xl font-bold text-sage-600 dark:text-sage-300 mb-2">$15<span className="text-base">/month</span></p>
                                        <p className="text-sm text-sage-500 dark:text-sage-400 mb-4 h-12">
                                            Become a core supporter of ongoing development.
                                        </p>
                                        <Button 
                                            className="w-full bg-pink-600 hover:bg-pink-700"
                                            onClick={() => handleDonation(15, true)}
                                        >
                                            <Calendar className="w-4 h-4 mr-2" />
                                            $15 Monthly
                                        </Button>
                                        <Badge className="mt-2 bg-sage-100 text-sage-800 dark:bg-sage-800 dark:text-sage-200">
                                            Best Value
                                        </Badge>
                                    </Card>

                                    <Card className="text-center p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-all">
                                        <Zap className="w-12 h-12 mx-auto mb-4 text-purple-600" />
                                        <h3 className="text-xl font-semibold mb-2 text-sage-900 dark:text-white">AI Sponsor</h3>
                                        <p className="text-3xl font-bold text-sage-600 dark:text-sage-300 mb-2">$30<span className="text-base">/month</span></p>
                                        <p className="text-sm text-sage-500 dark:text-sage-400 mb-4 h-12">
                                            Directly fund the powerful AI model hosting.
                                        </p>
                                        <Button 
                                            className="w-full bg-purple-600 hover:bg-purple-700"
                                            onClick={() => handleDonation(30, true)}
                                        >
                                            <Calendar className="w-4 h-4 mr-2" />
                                            $30 Monthly
                                        </Button>
                                    </Card>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="mt-8 text-center">
                            <p className="text-sage-600 dark:text-sage-300 mb-4">
                                Prefer a different amount? Every contribution helps!
                            </p>
                            <Button variant="outline" className="border-sage-300 dark:border-sage-600">
                                Custom Amount
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Transparency */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-sage-200 dark:border-sage-700 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-sage-900 dark:text-white">
                            Transparency & Updates
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sage-700 dark:text-sage-300">
                            I believe in being completely transparent about how your donations are used. Regular updates will be posted in our forum showing:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-sage-600 dark:text-sage-300 ml-4">
                            <li>Monthly hosting and infrastructure costs</li>
                            <li>Development progress and new features added</li>
                            <li>AI model improvements and accuracy gains</li>
                            <li>Community growth and usage statistics</li>
                        </ul>
                        <p className="text-sage-700 dark:text-sage-300">
                            Your trust means everything to me, and I'm committed to using every dollar to make Geck Inspect better for everyone.
                        </p>
                    </CardContent>
                </Card>

                {/* Thank You */}
                <div className="text-center bg-gradient-to-r from-sage-100 to-earth-100 dark:from-gray-800 dark:to-gray-700 p-8 rounded-xl">
                    <Heart className="w-16 h-16 mx-auto mb-4 text-red-500" />
                    <h2 className="text-2xl font-bold text-sage-900 dark:text-white mb-4">
                        Thank You for Being Part of Our Community
                    </h2>
                    <p className="text-sage-700 dark:text-sage-300 max-w-2xl mx-auto">
                        Whether you donate, contribute photos, help other users, or simply use and enjoy Geck Inspect, 
                        you're helping me build something amazing for crested gecko enthusiasts everywhere.
                    </p>
                </div>
            </div>
        </div>
    );
}