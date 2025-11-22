import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ForumPost, ForumComment, User, ForumCategory, Notification } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, MessageSquare, User as UserIcon, Calendar, ArrowLeft, Trash2, CornerDownRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ForumPostPage() {
    const location = useLocation();
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [category, setCategory] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const postId = new URLSearchParams(location.search).get('id');

    useEffect(() => {
        const fetchData = async () => {
            if (!postId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const [user, fetchedPost] = await Promise.all([
                    User.me().catch(() => null),
                    ForumPost.get(postId)
                ]);
                
                setCurrentUser(user);
                
                if (fetchedPost) {
                    setPost(fetchedPost);
                    const [fetchedComments, fetchedCategory] = await Promise.all([
                        ForumComment.filter({ post_id: postId }, '-created_date'),
                        ForumCategory.get(fetchedPost.category_id)
                    ]);
                    setComments(fetchedComments);
                    setCategory(fetchedCategory);
                }
            } catch (error) {
                console.error("Failed to load post data:", error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [postId]);

    const handleLike = async (item, type) => {
        if (!currentUser) return;

        const likedBy = item.liked_by_users || [];
        const isLiked = likedBy.includes(currentUser.email);
        const newLikedBy = isLiked 
            ? likedBy.filter(email => email !== currentUser.email)
            : [...likedBy, currentUser.email];

        try {
            if (type === 'post') {
                const updatedPost = await ForumPost.update(item.id, { liked_by_users: newLikedBy });
                setPost(updatedPost);
            } else {
                const updatedComment = await ForumComment.update(item.id, { liked_by_users: newLikedBy });
                setComments(comments.map(c => c.id === item.id ? updatedComment : c));
            }
        } catch (error) {
            console.error("Failed to update like:", error);
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim() || !currentUser) return;
        
        try {
            const commentData = {
                post_id: postId,
                content: newComment,
                author_name: currentUser.full_name,
                parent_comment_id: replyingTo?.id || null,
            };

            const createdComment = await ForumComment.create(commentData);
            
            // Send notification if replying to someone
            if (replyingTo && replyingTo.created_by !== currentUser.email) {
                await Notification.create({
                    user_email: replyingTo.created_by,
                    type: 'new_reply',
                    content: `${currentUser.full_name} replied to your comment: "${newComment.substring(0, 50)}${newComment.length > 50 ? '...' : ''}"`,
                    link: `/ForumPost?id=${postId}`,
                    metadata: { comment_id: createdComment.id, post_id: postId }
                });
            }
            
            setComments([createdComment, ...comments]);
            setNewComment('');
            setReplyingTo(null);
        } catch (error) {
            console.error("Failed to post comment:", error);
        }
    };

    const handleDeletePost = async () => {
        if (!deleteTarget || deleteTarget.type !== 'post') return;
        
        try {
            await ForumPost.delete(deleteTarget.id);
            window.location.href = createPageUrl('Forum');
        } catch (error) {
            console.error("Failed to delete post:", error);
        }
        setDeleteTarget(null);
    };

    const handleDeleteComment = async () => {
        if (!deleteTarget || deleteTarget.type !== 'comment') return;
        
        try {
            await ForumComment.delete(deleteTarget.id);
            setComments(comments.filter(c => c.id !== deleteTarget.id));
        } catch (error) {
            console.error("Failed to delete comment:", error);
        }
        setDeleteTarget(null);
    };

    if (isLoading) {
        return <div className="p-8 text-center text-white">Loading post...</div>;
    }

    if (!post) {
        return <div className="p-8 text-center text-white">Post not found.</div>;
    }
    
    const isPostLiked = post.liked_by_users?.includes(currentUser?.email);

    // Organize comments into threads
    const topLevelComments = comments.filter(c => !c.parent_comment_id);
    const commentReplies = {};
    comments.forEach(c => {
        if (c.parent_comment_id) {
            if (!commentReplies[c.parent_comment_id]) {
                commentReplies[c.parent_comment_id] = [];
            }
            commentReplies[c.parent_comment_id].push(c);
        }
    });

    const renderComment = (comment, isReply = false) => {
        const isCommentLiked = comment.liked_by_users?.includes(currentUser?.email);
        
        return (
            <div key={comment.id} className={isReply ? 'ml-8 mt-3' : ''}>
                <Card className="bg-slate-900 border-slate-700">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <Link 
                                to={createPageUrl(`PublicProfile?userId=${comment.created_by}`)}
                                className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
                            >
                                {comment.author_name}
                            </Link>
                            <span className="text-xs text-slate-500">
                                {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
                            </span>
                        </div>
                        <p className="text-slate-300 mb-3">{comment.content}</p>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleLike(comment, 'comment')}
                                className={`flex items-center gap-1 text-xs ${isCommentLiked ? 'text-emerald-400' : 'text-slate-400'}`}
                                disabled={!currentUser}
                            >
                                <ThumbsUp className={`w-3 h-3 ${isCommentLiked ? 'fill-current' : ''}`} />
                                ({comment.liked_by_users?.length || 0})
                            </Button>
                            {currentUser && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setReplyingTo(comment)}
                                    className="text-slate-400 hover:text-slate-200 text-xs"
                                >
                                    <CornerDownRight className="w-3 h-3 mr-1" />
                                    Reply
                                </Button>
                            )}
                            {currentUser?.role === 'admin' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTarget({ type: 'comment', id: comment.id })}
                                    className="text-red-500 hover:text-red-700 text-xs ml-auto"
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {/* Render replies */}
                {commentReplies[comment.id] && (
                    <div className="space-y-3 mt-3">
                        {commentReplies[comment.id].map(reply => renderComment(reply, true))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 bg-slate-950 text-slate-100 min-h-screen">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <Link to={createPageUrl("Forum")} className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Forum
                    </Link>
                    {category && <p className="text-sm text-slate-400">In <span className="font-semibold text-emerald-400">{category.name}</span></p>}
                </div>

                <Card className="bg-slate-900 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-3xl text-slate-100">{post.title}</CardTitle>
                        <div className="text-sm text-slate-400 flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1"><UserIcon className="w-4 h-4"/>{post.author_name}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/>{format(new Date(post.created_date), 'PPP')}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="prose prose-invert max-w-none text-slate-300">
                        <p>{post.content}</p>
                    </CardContent>
                    <CardFooter className="border-t border-slate-700 pt-4 flex justify-between">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleLike(post, 'post')}
                            className={`flex items-center gap-2 ${isPostLiked ? 'text-emerald-400' : 'text-slate-400'}`}
                            disabled={!currentUser}
                        >
                            <ThumbsUp className={`w-4 h-4 ${isPostLiked ? 'fill-current' : ''}`} />
                            Like ({post.liked_by_users?.length || 0})
                        </Button>
                        {currentUser?.role === 'admin' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget({ type: 'post', id: post.id })}
                                className="text-red-500 hover:text-red-700"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Post
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-slate-100">{comments.length} Comments</h3>
                    {topLevelComments.map(comment => renderComment(comment))}
                    {topLevelComments.length === 0 && (
                        <p className="text-slate-400 text-center py-8">No comments yet. Be the first to comment!</p>
                    )}
                </div>

                {currentUser && (
                    <Card className="bg-slate-900 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-slate-100">
                                {replyingTo ? `Reply to ${replyingTo.author_name}` : 'Leave a Comment'}
                            </CardTitle>
                            {replyingTo && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setReplyingTo(null)}
                                    className="text-slate-400 hover:text-slate-200"
                                >
                                    Cancel Reply
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder={replyingTo ? `Reply to ${replyingTo.author_name}...` : "Write your comment here..."}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="bg-slate-800 border-slate-600 text-slate-100 h-24"
                            />
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handlePostComment} className="bg-emerald-600 hover:bg-emerald-700">
                                {replyingTo ? 'Post Reply' : 'Post Comment'}
                            </Button>
                        </CardFooter>
                    </Card>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this {deleteTarget?.type}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={deleteTarget?.type === 'post' ? handleDeletePost : handleDeleteComment}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}