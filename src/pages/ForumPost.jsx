import { useBlockedAuthors } from '@/hooks/useBlockedAuthors';
import ReportContent from '@/components/support/ReportContent';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ForumPost, ForumComment, User, ForumCategory, Notification, ForumLike } from '@/entities/all';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { ForumPhotoGrid, ForumPhotoPicker, forumPhotoList } from '@/components/forum/ForumPhotos';
import { arrangeForumComments } from '@/lib/forumThreads';
import {
    ThumbsUp,
    User as UserIcon,
    Calendar,
    ArrowLeft,
    Trash2,
    CornerDownRight,
    Loader2,
    X,
    Pencil,
    Pin,
    Lock,
    Unlock,
    Eye,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Forum post detail page, fixes applied April 2026:
 *
 * 1. "Post comment" button: the async submit is now wired through
 *    explicit state (isPosting) with a visible loading indicator and
 *    a toast on failure. The previous version swallowed errors
 *    silently which made it feel like nothing happened.
 * 2. Cancel button for new (top-level) comments as well as replies.
 *    The old version only had "Cancel Reply".
 * 3. Clicking Reply on a different thread now CLEARS any draft text
 *    AND scrolls the comment box into view with a focus, so it's
 *    obvious that the reply target changed. The composer card also
 *    shows a colored "Replying to X" badge.
 * 4. Delete is no longer admin-only, the post/comment OWNER also
 *    sees a delete button. Admin still has override for both.
 * 5. Better "not found" state with a back button and an auto-refresh
 *    suggestion so users who bookmarked a deleted post don't just
 *    land on a blank page.
 */
export default function ForumPostPage() {
    const blockedAuthors = useBlockedAuthors();
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const composerRef = useRef(null);
    const composerTextareaRef = useRef(null);

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [category, setCategory] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [isPosting, setIsPosting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [likesData, setLikesData] = useState({});
    const [postDraft, setPostDraft] = useState(null);
    const [isSavingPost, setIsSavingPost] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [commentDraft, setCommentDraft] = useState('');
    const [isSavingComment, setIsSavingComment] = useState(false);

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
                    ForumPost.get(postId),
                ]);
                setCurrentUser(user);

                if (fetchedPost) {
                    setPost(fetchedPost);
                    // Count the view: once per member per post, done by the
                    // database so nobody can type in a number.
                    if (user) {
                        supabase
                            .rpc('record_forum_post_view', { p_post_id: postId })
                            .then(({ data }) => {
                                if (data != null) setPost((prev) => (prev ? { ...prev, view_count: data } : prev));
                            })
                            .catch(() => {});
                    }
                    const [fetchedComments, fetchedCategory, allLikes] = await Promise.all([
                        ForumComment.filter({ post_id: postId }, '-created_date'),
                        fetchedPost.category_id ? ForumCategory.get(fetchedPost.category_id).catch(() => null) : null,
                        ForumLike.filter({ target_id: postId }).catch(() => []),
                    ]);
                    setComments(fetchedComments);
                    setCategory(fetchedCategory);

                    // Initial likes data for the post + every comment
                    const next = {};
                    next[postId] = {
                        count: allLikes.length,
                        userLiked: user ? allLikes.some((l) => l.user_email === user.email) : false,
                    };
                    if (fetchedComments.length > 0) {
                        const commentLikes = await Promise.all(
                            fetchedComments.map((c) => ForumLike.filter({ target_id: c.id }).catch(() => []))
                        );
                        fetchedComments.forEach((c, i) => {
                            next[c.id] = {
                                count: commentLikes[i].length,
                                userLiked: user ? commentLikes[i].some((l) => l.user_email === user.email) : false,
                            };
                        });
                    }
                    setLikesData(next);
                }
            } catch (error) {
                console.error('Failed to load post data:', error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [postId]);

    const handleLike = async (item, type) => {
        if (!currentUser) return;
        const current = likesData[item.id] || { count: 0, userLiked: false };
        const isLiked = current.userLiked;
        setLikesData((prev) => ({
            ...prev,
            [item.id]: {
                count: isLiked ? current.count - 1 : current.count + 1,
                userLiked: !isLiked,
            },
        }));
        try {
            if (isLiked) {
                const existing = await ForumLike.filter({
                    target_id: item.id,
                    user_email: currentUser.email,
                });
                if (existing.length > 0) await ForumLike.delete(existing[0].id);
            } else {
                await ForumLike.create({
                    target_id: item.id,
                    target_type: type,
                    user_email: currentUser.email,
                });
            }
        } catch (error) {
            console.error('Failed to update like:', error);
            setLikesData((prev) => ({ ...prev, [item.id]: current }));
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim() || !currentUser || isPosting) return;
        setIsPosting(true);
        try {
            const commentData = {
                post_id: postId,
                content: newComment.trim(),
                // Never the email (sign-up doesn't ask for a name).
                author_name: currentUser.full_name || currentUser.business_name || currentUser.breeder_name || 'Geck Inspect member',
                parent_comment_id: replyingTo?.id || null,
            };
            const createdComment = await ForumComment.create(commentData);

            // The database dispatcher reads recipient preferences and handles
            // email/push. Clients cannot read another member's private settings.
            try {
                const recipient = replyingTo?.created_by || post?.created_by;
                if (recipient && recipient !== currentUser.email) {
                    await Notification.create({
                        user_email: recipient,
                        type: replyingTo ? 'new_reply' : 'new_comment',
                        content: `${commentData.author_name} ${replyingTo ? 'replied to your comment' : 'commented on your post'}: "${commentData.content.substring(0, 50)}${commentData.content.length > 50 ? '...' : ''}"`,
                        link: `/ForumPost?id=${postId}`,
                        metadata: { comment_id: createdComment.id, post_id: postId },
                    });
                }
            } catch (notifErr) {
                console.warn('Notification failed but comment saved:', notifErr);
            }

            setComments((prev) => [createdComment, ...prev]);
            setNewComment('');
            setReplyingTo(null);
            toast({ title: 'Posted' });
        } catch (error) {
            console.error('Failed to post comment:', error);
            toast({
                title: 'Could not post comment',
                description: error.message || 'Try again in a moment.',
                variant: 'destructive',
            });
        }
        setIsPosting(false);
    };

    // When the user clicks Reply on a comment, reset the composer
    // (so we don't keep draft text that was meant for a different
    // target) and focus/scroll it into view so the state change is
    // obvious.
    const handleStartReply = (comment) => {
        setReplyingTo(comment);
        setNewComment('');
        requestAnimationFrame(() => {
            if (composerRef.current) {
                composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            if (composerTextareaRef.current) {
                composerTextareaRef.current.focus();
            }
        });
    };

    const handleCancelDraft = () => {
        setNewComment('');
        setReplyingTo(null);
    };

    const handleDeletePost = async () => {
        if (!deleteTarget || deleteTarget.type !== 'post') return;
        try {
            await ForumPost.delete(deleteTarget.id);
            toast({ title: 'Post deleted' });
            navigate(createPageUrl('Forum'));
        } catch (error) {
            console.error('Failed to delete post:', error);
            toast({
                title: 'Delete failed',
                description: error.message || 'You may not have permission.',
                variant: 'destructive',
            });
        }
        setDeleteTarget(null);
    };

    const handleDeleteComment = async () => {
        if (!deleteTarget || deleteTarget.type !== 'comment') return;
        try {
            await ForumComment.delete(deleteTarget.id);
            setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id));
            toast({ title: 'Comment deleted' });
        } catch (error) {
            console.error('Failed to delete comment:', error);
            toast({
                title: 'Delete failed',
                description: error.message || 'You may not have permission.',
                variant: 'destructive',
            });
        }
        setDeleteTarget(null);
    };

    const startEditPost = () => {
        setPostDraft({
            title: post.title || '',
            content: post.content || '',
            image_urls: forumPhotoList(post.image_urls),
        });
    };

    const handleSavePost = async () => {
        if (!postDraft || !postDraft.title.trim() || !postDraft.content.trim()) return;
        setIsSavingPost(true);
        try {
            const saved = await ForumPost.update(post.id, {
                title: postDraft.title.trim(),
                content: postDraft.content.trim(),
                image_urls: forumPhotoList(postDraft.image_urls),
            });
            setPost((prev) => ({ ...prev, ...saved }));
            setPostDraft(null);
            toast({ title: 'Post updated' });
        } catch (error) {
            toast({ title: 'Could not save', description: error.message || 'Try again in a moment.', variant: 'destructive' });
        }
        setIsSavingPost(false);
    };

    const startEditComment = (comment) => {
        setEditingCommentId(comment.id);
        setCommentDraft(comment.content || '');
    };

    const handleSaveComment = async () => {
        if (!editingCommentId || !commentDraft.trim()) return;
        setIsSavingComment(true);
        try {
            const saved = await ForumComment.update(editingCommentId, { content: commentDraft.trim() });
            setComments((prev) => prev.map((c) => (c.id === editingCommentId ? { ...c, ...saved } : c)));
            setEditingCommentId(null);
            setCommentDraft('');
            toast({ title: 'Comment updated' });
        } catch (error) {
            toast({ title: 'Could not save', description: error.message || 'Try again in a moment.', variant: 'destructive' });
        }
        setIsSavingComment(false);
    };

    // Admin only (the database ignores these fields from anyone else).
    const handleToggleFlag = async (field) => {
        const next = !post[field];
        try {
            const saved = await ForumPost.update(post.id, { [field]: next });
            setPost((prev) => ({ ...prev, ...saved }));
            toast({
                title:
                    field === 'is_pinned'
                        ? next ? 'Pinned to the top of the forum' : 'Unpinned'
                        : next ? 'Thread locked. No new comments.' : 'Thread unlocked',
            });
        } catch (error) {
            toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex items-center justify-center text-center text-slate-400">
                <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading post...
                </div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 md:p-8">
                <div className="max-w-xl mx-auto text-center space-y-4">
                    <h2 className="text-2xl font-bold text-slate-100">Post not found</h2>
                    <p className="text-slate-400">
                        This post was deleted or the link is no longer valid.
                    </p>
                    <Link to={createPageUrl('Forum')} className="inline-block">
                        <Button>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Forum
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const isPostLiked = likesData[post.id]?.userLiked || false;
    const postLikeCount = likesData[post.id]?.count ?? 0;
    if (post && blockedAuthors.has(post.created_by)) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 md:p-8">
                <div className="max-w-xl mx-auto text-center space-y-4">
                    <h1 className="text-2xl font-bold text-slate-100">Post hidden</h1>
                    <p className="text-slate-400">You blocked this author. Manage blocked accounts in Settings.</p>
                    <Link className="inline-block touch:inline-flex touch:items-center touch:min-h-11 underline text-emerald-400 hover:text-emerald-300" to="/Forum">Return to the forum</Link>
                </div>
            </div>
        );
    }

    const isPostOwner = currentUser?.email && post?.created_by === currentUser.email;
    const isAdmin = currentUser?.role === 'admin';
    const canDeletePost = isPostOwner || isAdmin;

    const isLocked = !!post.is_locked;
    const canComment = !!currentUser && (!isLocked || isAdmin);
    const {
        topLevel: topLevelComments,
        replies: commentReplies,
        orphanIds,
        visibleCount: visibleCommentCount,
    } = arrangeForumComments(comments, (c) => blockedAuthors.has(c.created_by));

    const renderComment = (comment, isReply = false) => {
        const isEditingThis = editingCommentId === comment.id;
        const isCommentLiked = likesData[comment.id]?.userLiked || false;
        const commentLikeCount = likesData[comment.id]?.count ?? 0;
        const isCommentOwner = currentUser?.email && comment?.created_by === currentUser.email;
        const canDeleteComment = isCommentOwner || isAdmin;

        return (
            <div key={comment.id} className={isReply ? 'ml-6 md:ml-10 mt-3' : ''}>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-1.5">
                            <Link
                                to={createPageUrl(`PublicProfile?email=${encodeURIComponent(comment.created_by || '')}`)}
                                className="relative touch-hit text-sm font-semibold text-emerald-400 hover:text-emerald-300"
                            >
                                {comment.author_name || 'Anonymous'}
                            </Link>
                            <span className="text-xs text-slate-500">
                                {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
                            </span>
                        </div>
                        {orphanIds.has(comment.id) && (
                            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                <CornerDownRight className="w-3 h-3" />
                                Reply to a comment that was deleted
                            </p>
                        )}
                        {isEditingThis ? (
                            <div className="space-y-2 mb-3">
                                <Textarea
                                    value={commentDraft}
                                    onChange={(e) => setCommentDraft(e.target.value)}
                                    className="bg-slate-950 border-slate-700 text-slate-100 min-h-24"
                                    aria-label="Edit your comment"
                                />
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { setEditingCommentId(null); setCommentDraft(''); }}
                                        disabled={isSavingComment}
                                        className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveComment}
                                        disabled={isSavingComment || !commentDraft.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                    >
                                        {isSavingComment && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                        Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-300 whitespace-pre-wrap mb-3">{comment.content}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLike(comment, 'comment')}
                                className={`flex items-center gap-1 text-xs h-7 ${
                                    isCommentLiked ? 'text-emerald-400' : 'text-slate-400'
                                }`}
                                disabled={!currentUser}
                            >
                                <ThumbsUp className={`w-3 h-3 ${isCommentLiked ? 'fill-current' : ''}`} />
                                ({commentLikeCount})
                            </Button>
                            {canComment && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStartReply(comment)}
                                    className="text-slate-400 hover:text-slate-200 text-xs h-7"
                                >
                                    <CornerDownRight className="w-3 h-3 mr-1" />
                                    Reply
                                </Button>
                            )}
                            <ReportContent entity="forum_comment" recordId={comment.id} authorEmail={comment.created_by} excerpt={comment.content} />
                            {isCommentOwner && !isEditingThis && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditComment(comment)}
                                    className="text-slate-400 hover:text-slate-200 text-xs h-7"
                                >
                                    <Pencil className="w-3 h-3 mr-1" />
                                    Edit
                                </Button>
                            )}
                            {canDeleteComment && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTarget({ type: 'comment', id: comment.id })}
                                    className="text-rose-400 hover:text-rose-300 text-xs h-7 ml-auto"
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {commentReplies[comment.id] && (
                    <div className="space-y-3 mt-3">
                        {commentReplies[comment.id].map((reply) => renderComment(reply, true))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 bg-slate-950 text-slate-100 min-h-screen">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <Link
                        to={createPageUrl('Forum')}
                        className="inline-flex items-center gap-2 touch:min-h-11 text-emerald-400 hover:text-emerald-300 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Forum
                    </Link>
                    {category && (
                        <p className="text-sm text-slate-400">
                            In <span className="font-semibold text-emerald-400">{category.name}</span>
                        </p>
                    )}
                </div>

                <Card>
                    {/* items-start keeps the signed-in "Report or block" ghost
                        button at its own width instead of stretching across
                        the card between the title and the byline. */}
                    <CardHeader className="items-start">
                        {postDraft ? (
                            <Input
                                value={postDraft.title}
                                onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value })}
                                className="text-lg bg-slate-950 border-slate-700 text-slate-100"
                                aria-label="Post title"
                            />
                        ) : (
                            <CardTitle className="text-2xl md:text-3xl text-slate-100 flex items-start gap-2">
                                {post.is_pinned && <Pin className="w-5 h-5 mt-1.5 text-amber-400 shrink-0" aria-label="Pinned" />}
                                {isLocked && <Lock className="w-5 h-5 mt-1.5 text-slate-400 shrink-0" aria-label="Locked" />}
                                <span>{post.title}</span>
                            </CardTitle>
                        )}
                        <ReportContent entity="forum_post" recordId={post.id} authorEmail={post.created_by} excerpt={post.content} />
                        <div className="text-sm text-slate-400 flex items-center gap-4 mt-2 flex-wrap">
                            <span className="flex items-center gap-1">
                                <UserIcon className="w-4 h-4" />
                                {post.author_name || 'Anonymous'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(post.created_date), 'PPP')}
                            </span>
                            <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {post.view_count || 0} {Number(post.view_count) === 1 ? 'view' : 'views'}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {postDraft ? (
                            <div className="space-y-3">
                                <Textarea
                                    value={postDraft.content}
                                    onChange={(e) => setPostDraft({ ...postDraft, content: e.target.value })}
                                    className="min-h-40 bg-slate-950 border-slate-700 text-slate-100"
                                    aria-label="Post text"
                                />
                                <ForumPhotoPicker
                                    value={postDraft.image_urls}
                                    onChange={(urls) => setPostDraft((prev) => ({ ...prev, image_urls: urls }))}
                                    disabled={isSavingPost}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setPostDraft(null)}
                                        disabled={isSavingPost}
                                        className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSavePost}
                                        disabled={isSavingPost || !postDraft.title.trim() || !postDraft.content.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                    >
                                        {isSavingPost && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Save changes
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                                    {post.content}
                                </p>
                                <ForumPhotoGrid value={post.image_urls} />
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="border-t border-slate-800 pt-4 flex flex-wrap gap-2 justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLike(post, 'post')}
                            className={`flex items-center gap-2 ${
                                isPostLiked ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                            disabled={!currentUser}
                        >
                            <ThumbsUp className={`w-4 h-4 ${isPostLiked ? 'fill-current' : ''}`} />
                            Like ({postLikeCount})
                        </Button>
                        <div className="flex flex-wrap items-center gap-1">
                            {isPostOwner && !postDraft && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={startEditPost}
                                    className="text-slate-300 hover:text-slate-100"
                                >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit post
                                </Button>
                            )}
                            {isAdmin && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleFlag('is_pinned')}
                                        className="text-amber-300 hover:text-amber-200"
                                    >
                                        <Pin className="w-4 h-4 mr-2" />
                                        {post.is_pinned ? 'Unpin' : 'Pin'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleFlag('is_locked')}
                                        className="text-slate-300 hover:text-slate-100"
                                    >
                                        {isLocked ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                                        {isLocked ? 'Unlock' : 'Lock'}
                                    </Button>
                                </>
                            )}
                            {canDeletePost && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTarget({ type: 'post', id: post.id })}
                                    className="text-rose-400 hover:text-rose-300"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete post
                                </Button>
                            )}
                        </div>
                    </CardFooter>
                </Card>

                <div className="space-y-3">
                    <h3 className="text-xl md:text-2xl font-bold text-slate-100">
                        {visibleCommentCount} {visibleCommentCount === 1 ? 'comment' : 'comments'}
                    </h3>
                    {topLevelComments.map((comment) => renderComment(comment))}
                    {topLevelComments.length === 0 && (
                        <p className="text-slate-500 text-center py-8">
                            No comments yet. Be the first to comment.
                        </p>
                    )}
                </div>

                {currentUser && isLocked && !isAdmin && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400 flex items-center gap-2">
                        <Lock className="w-4 h-4 shrink-0" />
                        This thread is locked, so it takes no new comments.
                    </div>
                )}

                {canComment && (
                    <Card
                        ref={composerRef}
                        className={`bg-slate-900 border transition-colors ${
                            replyingTo
                                ? 'border-emerald-500/40 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]'
                                : 'border-slate-800'
                        }`}
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="text-slate-100 text-base">
                                        {replyingTo ? 'Reply to comment' : 'Leave a comment'}
                                    </CardTitle>
                                    {replyingTo && (
                                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                                            <CornerDownRight className="w-3 h-3" />
                                            Replying to{' '}
                                            <span className="font-semibold">
                                                {replyingTo.author_name || 'a comment'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                ref={composerTextareaRef}
                                placeholder={
                                    replyingTo
                                        ? `Write your reply to ${replyingTo.author_name || 'this comment'}...`
                                        : 'Write your comment here...'
                                }
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="bg-slate-950 border-slate-700 text-slate-100 min-h-28"
                                onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        handlePostComment();
                                    }
                                }}
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                                Tip: Cmd/Ctrl + Enter to post
                            </p>
                        </CardContent>
                        <CardFooter className="flex flex-wrap justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={handleCancelDraft}
                                disabled={!newComment.trim() && !replyingTo}
                                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                            >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                            <Button
                                onClick={handlePostComment}
                                disabled={isPosting || !newComment.trim()}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                                {isPosting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {replyingTo ? 'Post reply' : 'Post comment'}
                            </Button>
                        </CardFooter>
                    </Card>
                )}
            </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this{' '}
                            {deleteTarget?.type}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setDeleteTarget(null)}
                            className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                            Cancel
                        </AlertDialogCancel>
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
