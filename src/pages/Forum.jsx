import { useEffect, useMemo, useState } from 'react';
import Seo from '@/components/seo/Seo';
import { ForumCategory, ForumPost, User } from '@/entities/all';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import {
    MessageSquare,
    Eye,
    PlusCircle,
    Pin,
    Loader2,
    Search,
    X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';

/**
 * Forum index ,  dark theme to match the rest of the app.
 *
 * Previous version used sage/earth light colors and cached the post
 * list for 5 minutes. The cache meant that when a user deleted a post
 * from ForumPost.jsx and navigated back here, the deleted title
 * would still be shown until the cache expired, and clicking it
 * would take them to a dead page. Now the list is re-fetched on
 * every mount.
 */
export default function ForumPage() {
    const [forumPrefs, setForumPrefs] = usePageSettings('forum_prefs', {
        sortOrder: 'newest',
        collapseCategories: false,
        showPinnedFirst: true,
    });
    const [categories, setCategories] = useState([]);
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', category_id: '' });
    const [isPosting, setIsPosting] = useState(false);
    const [search, setSearch] = useState('');
    const [collapsedCats, setCollapsedCats] = useState(new Set());

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [user, fetchedCategories, fetchedPosts] = await Promise.all([
                User.me().catch(() => null),
                ForumCategory.list(),
                ForumPost.list('-created_date'),
            ]);
            setCurrentUser(user);
            setCategories(
                [...fetchedCategories].sort(
                    (a, b) => (a.order_position ?? 0) - (b.order_position ?? 0)
                )
            );
            setPosts(fetchedPosts);
        } catch (error) {
            console.error('Failed to load forum data:', error);
        }
        setIsLoading(false);
    };

    // Always fetch fresh on mount. No time-based cache ,  deleted posts
    // need to disappear immediately when the user navigates back here.
    useEffect(() => {
        loadData();
    }, []);

    const handleCreatePost = async () => {
        if (!newPost.title.trim() || !newPost.content.trim() || !newPost.category_id || !currentUser) {
            return;
        }
        setIsPosting(true);
        try {
            const createdPost = await ForumPost.create({
                title: newPost.title.trim(),
                content: newPost.content.trim(),
                category_id: newPost.category_id,
                author_name: currentUser.full_name || currentUser.breeder_name || currentUser.email,
            });
            setPosts((prev) => [createdPost, ...prev]);
            setShowCreatePost(false);
            setNewPost({ title: '', content: '', category_id: '' });
        } catch (error) {
            console.error('Failed to create post:', error);
        }
        setIsPosting(false);
    };

    const handleCancelPost = () => {
        setShowCreatePost(false);
        setNewPost({ title: '', content: '', category_id: '' });
    };

    const filteredPosts = useMemo(() => {
        let list = posts;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (p) =>
                    p.title?.toLowerCase().includes(q) ||
                    p.content?.toLowerCase().includes(q) ||
                    p.author_name?.toLowerCase().includes(q)
            );
        }
        list = [...list].sort((a, b) => {
            if (forumPrefs.showPinnedFirst) {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
            }
            if (forumPrefs.sortOrder === 'oldest') return new Date(a.created_date) - new Date(b.created_date);
            if (forumPrefs.sortOrder === 'most_viewed') return (b.view_count || 0) - (a.view_count || 0);
            return new Date(b.created_date) - new Date(a.created_date);
        });
        return list;
    }, [posts, search, forumPrefs.sortOrder, forumPrefs.showPinnedFirst]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading forum...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <Seo
                title="Community Forum"
                description="Connect with fellow crested gecko enthusiasts. Discuss breeding, morphs, care tips, and share your gecko stories."
                path="/Forum"
                keywords={['gecko forum', 'crested gecko community', 'reptile discussion', 'breeder forum']}
            />
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-bold text-slate-100 mb-1">
                            Community Forum
                        </h1>
                        <p className="text-sm md:text-lg text-slate-400">
                            Connect, share, and learn with fellow gecko enthusiasts.
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <PageSettingsPanel title="Forum Settings">
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Sort Posts</Label>
                                <Select value={forumPrefs.sortOrder} onValueChange={v => setForumPrefs({ sortOrder: v })}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">Newest First</SelectItem>
                                        <SelectItem value="oldest">Oldest First</SelectItem>
                                        <SelectItem value="most_viewed">Most Viewed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Pinned Posts First</Label>
                                <Switch checked={forumPrefs.showPinnedFirst} onCheckedChange={v => setForumPrefs({ showPinnedFirst: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Collapse Categories</Label>
                                <Switch checked={forumPrefs.collapseCategories} onCheckedChange={v => setForumPrefs({ collapseCategories: v })} />
                            </div>
                        </PageSettingsPanel>
                    {currentUser && (
                        <Button
                            onClick={() => setShowCreatePost((v) => !v)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                        >
                            {showCreatePost ? (
                                <>
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    New post
                                </>
                            )}
                        </Button>
                    )}
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                        placeholder="Search posts by title, content, or author..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-slate-900 border-slate-700 text-slate-100"
                    />
                </div>

                {/* Create post form */}
                {showCreatePost && (
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-slate-100">Create a new post</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Input
                                placeholder="Post title"
                                value={newPost.title}
                                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                                className="bg-slate-950 border-slate-700 text-slate-100"
                            />
                            <Textarea
                                placeholder="What's on your mind?"
                                value={newPost.content}
                                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                                className="h-32 bg-slate-950 border-slate-700 text-slate-100"
                            />
                            <Select
                                value={newPost.category_id}
                                onValueChange={(value) => setNewPost({ ...newPost, category_id: value })}
                            >
                                <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={handleCancelPost}
                                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreatePost}
                                disabled={
                                    isPosting ||
                                    !newPost.title.trim() ||
                                    !newPost.content.trim() ||
                                    !newPost.category_id
                                }
                                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                                {isPosting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Submit post
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {/* Category feed */}
                {categories.map((category) => {
                    const categoryPosts = filteredPosts.filter((p) => p.category_id === category.id);
                    if (categoryPosts.length === 0) return null;
                    const isCatCollapsed = forumPrefs.collapseCategories
                        ? !collapsedCats.has(category.id)
                        : collapsedCats.has(category.id);
                    return (
                        <div key={category.id}>
                            <h2
                                className="text-xl md:text-2xl font-bold text-slate-200 mb-3 cursor-pointer flex items-center gap-2 select-none"
                                onClick={() => setCollapsedCats(prev => {
                                    const next = new Set(prev);
                                    next.has(category.id) ? next.delete(category.id) : next.add(category.id);
                                    return next;
                                })}
                            >
                                {category.name}
                                <span className="text-sm text-slate-500 font-normal">({categoryPosts.length})</span>
                            </h2>
                            {!isCatCollapsed && <Card className="bg-slate-900 border-slate-800">
                                <CardContent className="p-0 divide-y divide-slate-800">
                                    {categoryPosts.map((post) => (
                                        <div
                                            key={post.id}
                                            className="p-4 flex items-center justify-between hover:bg-slate-800/60 transition-colors"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <MessageSquare className="w-5 h-5 text-slate-500 shrink-0" />
                                                <div className="min-w-0">
                                                    <Link
                                                        to={`${createPageUrl('ForumPost')}?id=${post.id}`}
                                                        className="text-base md:text-lg font-semibold text-slate-100 hover:text-emerald-300 transition-colors truncate block"
                                                    >
                                                        {post.title}
                                                    </Link>
                                                    <p className="text-xs md:text-sm text-slate-500 truncate">
                                                        by {post.author_name || 'Unknown'} ·{' '}
                                                        {formatDistanceToNow(new Date(post.created_date), {
                                                            addSuffix: true,
                                                        })}
                                                    </p>
                                                </div>
                                                {post.is_pinned && (
                                                    <Pin className="w-4 h-4 text-amber-400 shrink-0" />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                                                <div className="flex items-center gap-1">
                                                    <Eye className="w-4 h-4" />
                                                    <span>{post.view_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>}
                        </div>
                    );
                })}

                {filteredPosts.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
                        <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-300 font-semibold mb-1">
                            {search ? 'No posts match that search.' : 'No posts yet.'}
                        </p>
                        <p className="text-slate-500 text-sm">
                            {search
                                ? 'Try a different keyword.'
                                : 'Be the first to start a discussion.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
