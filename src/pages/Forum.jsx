
import React, { useState, useEffect } from 'react';
import { ForumCategory, ForumPost, User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MessageSquare, ThumbsUp, Eye, PlusCircle, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';

// Create a page-specific cache
const forumCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  
  get() {
    if (this.data && this.timestamp && (Date.now() - this.timestamp) < this.CACHE_DURATION) {
      return this.data;
    }
    return null;
  },
  
  set(data) {
    this.data = data;
    this.timestamp = Date.now();
  },
  
  clear() {
    this.data = null;
    this.timestamp = null;
  }
};

export default function ForumPage() {
    const [categories, setCategories] = useState([]);
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [newPost, setNewPost] = useState({ title: '', content: '', category_id: '' });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            
            // Check cache first
            const cachedData = forumCache.get();
            if (cachedData) {
                console.log('Using cached forum data');
                setCategories(cachedData.categories);
                setPosts(cachedData.posts);
                setCurrentUser(cachedData.user);
                setIsLoading(false);
                return;
            }
            
            try {
                const [user, fetchedCategories, fetchedPosts] = await Promise.all([
                    User.me().catch(() => null),
                    ForumCategory.list(),
                    ForumPost.list('-created_date')
                ]);
                
                const sortedCategories = fetchedCategories.sort((a,b) => a.order_position - b.order_position);
                
                // Cache the results
                forumCache.set({
                    user,
                    categories: sortedCategories,
                    posts: fetchedPosts
                });
                
                setCurrentUser(user);
                setCategories(sortedCategories);
                setPosts(fetchedPosts);
            } catch (error) {
                console.error("Failed to load forum data:", error);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleCreatePost = async () => {
        if (!newPost.title || !newPost.content || !newPost.category_id || !currentUser) return;
        try {
            const createdPost = await ForumPost.create({
                ...newPost,
                author_name: currentUser.full_name,
            });
            setPosts([createdPost, ...posts]);
            setShowCreatePost(false);
            setNewPost({ title: '', content: '', category_id: '' });
            
            // Clear cache so it refreshes next time
            forumCache.clear();
        } catch (error) {
            console.error("Failed to create post:", error);
        }
    };

    if (isLoading) {
        return <div className="p-8">Loading forum...</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-5xl font-bold text-sage-900 mb-2">Community Forum</h1>
                    <p className="text-lg text-sage-600">Connect, share, and learn with fellow gecko enthusiasts.</p>
                </div>
                
                <div className="flex justify-end">
                    {currentUser && (
                        <Button onClick={() => setShowCreatePost(!showCreatePost)}>
                            <PlusCircle className="w-4 h-4 mr-2" />
                            {showCreatePost ? 'Cancel' : 'Create New Post'}
                        </Button>
                    )}
                </div>

                {showCreatePost && (
                    <Card className="bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Create a New Post</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                placeholder="Post Title"
                                value={newPost.title}
                                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                            />
                            <Textarea
                                placeholder="What's on your mind?"
                                value={newPost.content}
                                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                                className="h-32"
                            />
                            <Select onValueChange={(value) => setNewPost({ ...newPost, category_id: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleCreatePost}>Submit Post</Button>
                        </CardFooter>
                    </Card>
                )}

                {categories.map(category => {
                    const categoryPosts = posts.filter(p => p.category_id === category.id);
                    if (categoryPosts.length === 0) return null;
                    return (
                        <div key={category.id}>
                            <h2 className="text-2xl font-bold text-sage-800 mb-4">{category.name}</h2>
                            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                                <CardContent className="p-0 divide-y divide-sage-200">
                                    {categoryPosts.map(post => (
                                        <div key={post.id} className="p-4 flex items-center justify-between hover:bg-sage-50/50">
                                            <div className="flex items-center gap-4">
                                                <MessageSquare className="w-6 h-6 text-sage-500 flex-shrink-0" />
                                                <div>
                                                    <Link to={createPageUrl(`ForumPost?id=${post.id}`)} className="text-lg font-bold text-sage-900 hover:underline">
                                                        {post.title}
                                                    </Link>
                                                    <p className="text-sm text-sage-600">
                                                        by {post.author_name} • {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
                                                    </p>
                                                </div>
                                                {post.is_pinned && <Pin className="w-4 h-4 text-orange-500" />}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-sage-600">
                                                <div className="flex items-center gap-1">
                                                    <ThumbsUp className="w-4 h-4" />
                                                    <span>0</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Eye className="w-4 h-4" />
                                                    <span>{post.view_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
