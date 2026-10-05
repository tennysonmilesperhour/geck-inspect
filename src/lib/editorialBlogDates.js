// Gives editorialFor() the per-post dates of the static blog posts.
// Imported only by the blog pages, so the 327 KB post data stays out of
// the Morph Guide, Care Guide and Genetics Guide pages (see editorial.js).
import { BLOG_POSTS } from '@/data/blog-posts';
import { registerBlogPosts } from '@/lib/editorial';

registerBlogPosts(BLOG_POSTS);
