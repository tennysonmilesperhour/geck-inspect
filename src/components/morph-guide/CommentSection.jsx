import React, { useState, useEffect } from 'react';
import { MorphGuideComment } from '@/entities/MorphGuideComment';
import { User } from '@/entities/User';
import { UploadFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Upload, Send, Clock, CheckCircle, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';

export default function CommentSection({ morphGuideId }) {
    const [comments, setComments] = useState([]);
    const [user, setUser] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        content: '',
        image_url: ''
    });
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        loadComments();
        loadUser();
    }, [morphGuideId]);

    const loadComments = async () => {
        try {
            const approvedComments = await MorphGuideComment.filter({
                morph_guide_id: morphGuideId,
                status: 'approved'
            }, '-created_date');
            setComments(approvedComments);
        } catch (error) {
            console.error('Failed to load comments:', error);
        }
    };

    const loadUser = async () => {
        try {
            const currentUser = await User.me();
            setUser(currentUser);
        } catch (error) {
            setUser(null);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingImage(true);
        try {
            const { file_url } = await UploadFile({ file });
            setFormData(prev => ({ ...prev, image_url: file_url }));
        } catch (error) {
            console.error('Failed to upload image:', error);
            alert('Failed to upload image. Please try again.');
        }
        setUploadingImage(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || !formData.subject.trim() || !formData.content.trim()) return;

        setIsSubmitting(true);
        try {
            await MorphGuideComment.create({
                morph_guide_id: morphGuideId,
                user_email: user.email,
                user_name: user.full_name,
                subject: formData.subject.trim(),
                content: formData.content.trim(),
                image_url: formData.image_url || undefined
            });

            setFormData({ subject: '', content: '', image_url: '' });
            setShowForm(false);
            alert('Comment submitted for review! It will appear after admin approval.');
        } catch (error) {
            console.error('Failed to submit comment:', error);
            alert('Failed to submit comment. Please try again.');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-sage-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Community Notes ({comments.length})
                </h3>
                {user && (
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        variant="outline"
                        size="sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Note
                    </Button>
                )}
            </div>

            {!user && (
                <Alert className="border-blue-200 bg-blue-50">
                    <MessageSquare className="h-4 w-4" />
                    <AlertDescription>
                        Sign in to add your own notes and observations about this morph.
                    </AlertDescription>
                </Alert>
            )}

            {showForm && user && (
                <Card className="border-sage-300">
                    <CardHeader>
                        <CardTitle className="text-lg">Add Your Note</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Input
                                    placeholder="Subject (e.g., 'Breeding Experience', 'Care Tips')"
                                    value={formData.subject}
                                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <Textarea
                                    placeholder="Share your experience, tips, or observations about this morph..."
                                    value={formData.content}
                                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                                    className="min-h-24"
                                    required
                                />
                            </div>
                            
                            {formData.image_url && (
                                <div className="relative">
                                    <img
                                        src={formData.image_url}
                                        alt="Attached"
                                        className="w-full max-w-xs h-32 object-cover rounded-lg border"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                                        className="absolute top-1 right-1"
                                    >
                                        ×
                                    </Button>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById('comment-image-upload').click()}
                                    disabled={uploadingImage}
                                >
                                    {uploadingImage ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Add Image
                                        </>
                                    )}
                                </Button>
                                <input
                                    id="comment-image-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />

                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowForm(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || !formData.subject.trim() || !formData.content.trim()}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                Submit for Review
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-4">
                {comments.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-8">
                            <MessageSquare className="w-12 h-12 text-sage-400 mx-auto mb-2" />
                            <p className="text-sage-600">No community notes yet.</p>
                            <p className="text-sm text-sage-500">Be the first to share your experience!</p>
                        </CardContent>
                    </Card>
                ) : (
                    comments.map((comment) => (
                        <Card key={comment.id} className="bg-white/90">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <h4 className="font-semibold text-sage-900">{comment.subject}</h4>
                                        <div className="flex items-center gap-2 text-sm text-sage-500">
                                            <span>{comment.user_name}</span>
                                            <span>•</span>
                                            <span>{format(new Date(comment.created_date), 'MMM d, yyyy')}</span>
                                            {comment.is_helpful && (
                                                <Badge variant="secondary" className="ml-2">
                                                    <Star className="w-3 h-3 mr-1" />
                                                    Helpful
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-green-50 text-green-700">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Approved
                                    </Badge>
                                </div>
                                
                                <p className="text-sage-700 mb-3">{comment.content}</p>
                                
                                {comment.image_url && (
                                    <img
                                        src={comment.image_url}
                                        alt="User submitted"
                                        className="w-full max-w-md h-48 object-cover rounded-lg border border-sage-200"
                                    />
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}