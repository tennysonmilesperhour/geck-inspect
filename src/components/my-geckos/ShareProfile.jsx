import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  QrCode, 
  Copy, 
  ExternalLink,
  Users,
  Globe,
  Instagram,
  Facebook,
  Youtube
} from 'lucide-react';

export default function ShareProfile({ user, geckos }) {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);

    React.useEffect(() => {
        if (user?.id) {
            const profileUrl = `${window.location.origin}/profile/${user.id}`;
            setShareUrl(profileUrl);

            // Generate QR Code URL using a public API
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profileUrl)}&qzone=1&margin=10&color=4a554a&bgcolor=ffffff`;
            setQrCodeUrl(qrApiUrl);
        }
    }, [user]);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const downloadQR = async () => {
        if (qrCodeUrl) {
            try {
                // Fetch the image from the API as a blob
                const response = await fetch(qrCodeUrl);
                if (!response.ok) throw new Error('Network response was not ok.');
                const blob = await response.blob();
                
                // Create a temporary link to trigger the download
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${user?.full_name || 'profile'}-qr-code.png`;
                document.body.appendChild(link);
                link.click();
                
                // Clean up
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Failed to download QR code:', error);
                // Fallback for browsers that might block the fetch
                window.open(qrCodeUrl, '_blank');
            }
        }
    };

    return (
        <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Share2 className="w-5 h-5" />
                        Share Your Collection
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Profile Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-sage-50 rounded-lg">
                            <Users className="w-6 h-6 mx-auto mb-2 text-sage-600" />
                            <div className="text-2xl font-bold text-sage-900">{geckos.length}</div>
                            <div className="text-sm text-sage-600">Geckos</div>
                        </div>
                        <div className="text-center p-4 bg-sage-50 rounded-lg">
                            <Badge className="w-6 h-6 mx-auto mb-2 text-sage-600" />
                            <div className="text-2xl font-bold text-sage-900">{geckos.filter(g => g.status === 'Breeder').length}</div>
                            <div className="text-sm text-sage-600">Breeders</div>
                        </div>
                        <div className="text-center p-4 bg-sage-50 rounded-lg">
                            <Badge className="w-6 h-6 mx-auto mb-2 text-sage-600" />
                            <div className="text-2xl font-bold text-sage-900">{new Set(geckos.map(g => g.sex).filter(Boolean)).size}</div>
                            <div className="text-sm text-sage-600">Sexes</div>
                        </div>
                        <div className="text-center p-4 bg-sage-50 rounded-lg">
                            <Globe className="w-6 h-6 mx-auto mb-2 text-sage-600" />
                            <div className="text-2xl font-bold text-sage-900">{user?.profile_public ? 'Public' : 'Private'}</div>
                            <div className="text-sm text-sage-600">Profile</div>
                        </div>
                    </div>

                    {/* Share URL */}
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sage-900">Collection URL</h3>
                        <div className="flex gap-2">
                            <Input
                                value={shareUrl}
                                readOnly
                                className="bg-gray-50"
                            />
                            <Button onClick={copyToClipboard} variant="outline">
                                {copied ? 'Copied!' : <><Copy className="w-4 h-4 mr-2" />Copy</>}
                            </Button>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sage-900">QR Code</h3>
                            <div className="border border-sage-200 rounded-lg p-4 bg-white">
                                {qrCodeUrl ? (
                                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
                                ) : (
                                    <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-sm text-gray-500">Generating QR...</div>
                                )}
                            </div>
                            <Button onClick={downloadQR} variant="outline" className="w-full" disabled={!qrCodeUrl}>
                                <QrCode className="w-4 h-4 mr-2" />
                                Download QR Code
                            </Button>
                        </div>

                        <div className="flex-1 space-y-4">
                            <h3 className="font-semibold text-sage-900">Your Social Links</h3>
                            <div className="space-y-2">
                                {user?.website_url && (
                                    <div className="flex items-center gap-2 p-2 bg-sage-50 rounded">
                                        <Globe className="w-4 h-4 text-sage-600" />
                                        <a href={user.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-sage-700 hover:text-sage-900">
                                            {user.website_url}
                                        </a>
                                        <ExternalLink className="w-3 h-3 text-sage-400" />
                                    </div>
                                )}
                                
                                {user?.instagram_handle && (
                                    <div className="flex items-center gap-2 p-2 bg-sage-50 rounded">
                                        <Instagram className="w-4 h-4 text-sage-600" />
                                        <a href={`https://instagram.com/${user.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="text-sm text-sage-700 hover:text-sage-900">
                                            @{user.instagram_handle}
                                        </a>
                                        <ExternalLink className="w-3 h-3 text-sage-400" />
                                    </div>
                                )}

                                {user?.facebook_url && (
                                    <div className="flex items-center gap-2 p-2 bg-sage-50 rounded">
                                        <Facebook className="w-4 h-4 text-sage-600" />
                                        <a href={user.facebook_url} target="_blank" rel="noopener noreferrer" className="text-sm text-sage-700 hover:text-sage-900">
                                            Facebook Profile
                                        </a>
                                        <ExternalLink className="w-3 h-3 text-sage-400" />
                                    </div>
                                )}

                                {user?.youtube_url && (
                                    <div className="flex items-center gap-2 p-2 bg-sage-50 rounded">
                                        <Youtube className="w-4 h-4 text-sage-600" />
                                        <a href={user.youtube_url} target="_blank" rel="noopener noreferrer" className="text-sm text-sage-700 hover:text-sage-900">
                                            YouTube Channel
                                        </a>
                                        <ExternalLink className="w-3 h-3 text-sage-400" />
                                    </div>
                                )}

                                {!user?.website_url && !user?.instagram_handle && !user?.facebook_url && !user?.youtube_url && (
                                    <p className="text-sm text-sage-500">No social links added yet. Go to Profile Settings to add them.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {user?.profile_public ? (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-green-800">
                                <Globe className="w-4 h-4 inline mr-1" />
                                Your profile is <strong>public</strong>. Others can view your collection using the link above.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-amber-800">
                                Your profile is currently <strong>private</strong>. Enable "Make Profile Public" in Profile Settings to share your collection.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}