import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, FileText, Sparkles, FolderTree,
  Settings as SettingsIcon, History,
} from 'lucide-react';

import BlogDashboard from './BlogDashboard';
import BlogPostsList from './BlogPostsList';
import BlogEditor from './BlogEditor';
import BlogAIGenerator from './BlogAIGenerator';
import BlogTaxonomy from './BlogTaxonomy';
import BlogSettingsPanel from './BlogSettings';
import BlogLogs from './BlogLogs';

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'posts',     label: 'Posts',         icon: FileText },
  { id: 'ai',        label: 'AI generator',  icon: Sparkles },
  { id: 'taxonomy',  label: 'Categories & tags', icon: FolderTree },
  { id: 'settings',  label: 'Settings',      icon: SettingsIcon },
  { id: 'logs',      label: 'Logs',          icon: History },
];

/**
 * Top-level admin Blog screen. Renders an internal tab strip and
 * delegates each tab to its own component. The "editor" is a virtual
 * tab — it activates when the user clicks Edit/Create on a post and
 * captures the active post id so the editor knows what to load.
 */
export default function BlogManager() {
  const [view, setView] = useState('dashboard');
  const [editingPost, setEditingPost] = useState(null); // null | post object | { id: null } sentinel for "new"

  const openNewPost = () => {
    setEditingPost({ id: null });
    setView('editor');
  };
  const openEditPost = (post) => {
    setEditingPost(post);
    setView('editor');
  };
  const backToPosts = () => {
    setEditingPost(null);
    setView('posts');
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
          <BlogDashboard
            onNavigate={setView}
            onCreatePost={openNewPost}
            onGenerate={() => setView('ai')}
          />
        );
      case 'posts':
        return (
          <BlogPostsList
            onCreatePost={openNewPost}
            onEditPost={openEditPost}
          />
        );
      case 'editor':
        return (
          <BlogEditor
            postId={editingPost?.id || null}
            initialPost={editingPost?.id ? editingPost : null}
            onBack={backToPosts}
            onSaved={(saved) => setEditingPost(saved)}
          />
        );
      case 'ai':
        return (
          <BlogAIGenerator
            onDraftCreated={(post) => openEditPost(post)}
          />
        );
      case 'taxonomy':
        return <BlogTaxonomy />;
      case 'settings':
        return <BlogSettingsPanel />;
      case 'logs':
        return <BlogLogs />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 rounded-lg bg-slate-900/60 border border-slate-800 p-1.5">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <Button
              key={v.id}
              size="sm"
              variant="ghost"
              onClick={() => setView(v.id)}
              className={
                active
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'text-slate-300 hover:bg-slate-800 border border-transparent'
              }
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {v.label}
            </Button>
          );
        })}
      </div>
      {renderView()}
    </div>
  );
}
