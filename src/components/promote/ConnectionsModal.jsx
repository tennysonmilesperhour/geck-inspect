import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Trash2, ExternalLink, Loader2, Cloud, Facebook, Instagram, MessageSquare } from 'lucide-react';
import { SocialPlatformConnection } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';

// Connections modal — manages per-user platform credentials.
//
// Bluesky: app-password auth, no OAuth. Set directly via the
// set-platform-connection edge function (encrypts at rest).
//
// Facebook Page + Instagram: Meta Graph API OAuth flow. We hit
// meta-oauth-start to get the dialog URL, redirect the user there,
// Meta redirects back to meta-oauth-callback which writes one row per
// Page + per linked IG Business account, then bounces them back here.
export default function ConnectionsModal({ open, onOpenChange, user }) {
  const [connections, setConnections] = useState([]);
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metaStarting, setMetaStarting] = useState(false);
  const [redditStarting, setRedditStarting] = useState(false);
  const [redditSubreddit, setRedditSubreddit] = useState('');

  const bluesky = connections.find((r) => r.platform === 'bluesky' && r.is_active);
  const facebookPages = connections.filter((r) => r.platform === 'facebook_page' && r.is_active);
  const igAccounts = connections.filter((r) => r.platform === 'instagram' && r.is_active);
  const reddit = connections.find((r) => r.platform === 'reddit' && r.is_active);

  const load = async () => {
    if (!user?.auth_user_id) return;
    setLoading(true);
    try {
      const rows = await SocialPlatformConnection.filter({ user_id: user.auth_user_id });
      setConnections(rows || []);
      const b = (rows || []).find((r) => r.platform === 'bluesky' && r.is_active);
      if (b) setHandle(b.account_handle || '');
      const r = (rows || []).find((row) => row.platform === 'reddit' && row.is_active);
      if (r) setRedditSubreddit(r.metadata?.default_subreddit || '');
    } catch (e) {
      console.warn('connections load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, user?.auth_user_id]);

  const handleSaveBluesky = async () => {
    if (!handle.trim() || !appPassword.trim()) {
      toast({ title: 'Both handle and app password required.' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-platform-connection', {
        body: {
          platform: 'bluesky',
          account_handle: handle.trim(),
          access_token: appPassword.trim(),
        },
      });
      if (error) throw new Error(error.message || 'set-platform-connection failed');
      if (data?.error) throw new Error(`${data.error}${data.detail ? `: ${data.detail}` : ''}`);
      setAppPassword('');
      await load();
      toast({ title: 'Bluesky connected', description: 'Direct posting is now active.' });
    } catch (e) {
      toast({ title: 'Save failed', description: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectMeta = async () => {
    setMetaStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-start', { body: {} });
      // FunctionsHttpError doesn't auto-parse the body for non-2xx
      // responses, so reach into error.context to surface the actual
      // server error (e.g. `meta_not_configured` with the list of
      // missing secrets).
      if (error) {
        let parsed = null;
        try {
          if (error.context && typeof error.context.json === 'function') {
            parsed = await error.context.json();
          } else if (error.context && typeof error.context.text === 'function') {
            parsed = JSON.parse(await error.context.text());
          }
        } catch { /* ignore */ }
        if (parsed?.error === 'meta_not_configured') {
          toast({
            title: 'Meta secrets not set',
            description: `Add these in Supabase → Settings → Edge Functions → Secrets: ${(parsed.missing || []).join(', ')}. See the Meta App setup checklist in the docs.`,
          });
          return;
        }
        throw new Error(parsed?.error || error.message || 'meta-oauth-start failed');
      }
      if (data?.error === 'meta_not_configured') {
        toast({
          title: 'Meta secrets not set',
          description: `Add these in Supabase → Settings → Edge Functions → Secrets: ${(data.missing || []).join(', ')}.`,
        });
        return;
      }
      if (data?.error) throw new Error(`${data.error}${data.detail ? `: ${data.detail}` : ''}`);
      if (!data?.url) throw new Error('No OAuth URL returned');
      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Connect failed', description: String(e?.message || e) });
    } finally {
      setMetaStarting(false);
    }
  };

  const handleConnectReddit = async () => {
    setRedditStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reddit-oauth-start', { body: {} });
      if (error) {
        let parsed = null;
        try {
          if (error.context && typeof error.context.json === 'function') {
            parsed = await error.context.json();
          } else if (error.context && typeof error.context.text === 'function') {
            parsed = JSON.parse(await error.context.text());
          }
        } catch { /* ignore */ }
        if (parsed?.error === 'reddit_not_configured') {
          toast({
            title: 'Reddit secrets not set',
            description: `Add these in Supabase → Settings → Edge Functions → Secrets: ${(parsed.missing || []).join(', ')}.`,
          });
          return;
        }
        throw new Error(parsed?.error || error.message || 'reddit-oauth-start failed');
      }
      if (!data?.url) throw new Error('No OAuth URL returned');
      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Reddit connect failed', description: String(e?.message || e) });
    } finally {
      setRedditStarting(false);
    }
  };

  // Update the target subreddit on an existing Reddit connection.
  // Stored in metadata.default_subreddit; the publish edge function
  // reads it on each post.
  const handleSaveRedditSubreddit = async () => {
    if (!reddit) return;
    const value = redditSubreddit.trim().replace(/^\/+/, '').replace(/^r\//, '').replace(/^u\//, 'u_');
    try {
      const { error } = await supabase
        .from('social_platform_connections')
        .update({
          metadata: { ...(reddit.metadata || {}), default_subreddit: value },
          updated_date: new Date().toISOString(),
        })
        .eq('id', reddit.id);
      if (error) throw error;
      await load();
      toast({ title: 'Reddit target updated', description: `Posts will now go to ${value}` });
    } catch (e) {
      toast({ title: 'Save failed', description: String(e?.message || e) });
    }
  };

  const handleDisconnect = async (row, niceName) => {
    if (!row) return;
    if (!confirm(`Disconnect ${niceName}? You can reconnect anytime.`)) return;
    try {
      await SocialPlatformConnection.delete(row.id);
      await load();
      toast({ title: `${niceName} disconnected.` });
    } catch (e) {
      toast({ title: 'Disconnect failed', description: String(e?.message || e) });
    }
  };

  // Detect a redirect-back from meta-oauth-callback so we can show a
  // toast and refresh the connection list. The callback bounces the user
  // back to this page with ?meta=connected or ?meta_err=<reason>.
  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('meta')) {
      const count = params.get('count');
      const partial = params.get('partial_errors');
      toast({
        title: 'Meta connected',
        description: `Linked ${count || '0'} account${count === '1' ? '' : 's'}${partial ? ` (with ${partial} partial errors)` : ''}`,
      });
      // Strip the params so a reload doesn't re-toast.
      params.delete('meta');
      params.delete('count');
      params.delete('partial_errors');
      const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', url);
      load();
    } else if (params.has('meta_err')) {
      toast({
        title: 'Meta connection failed',
        description: params.get('meta_err') || 'unknown error',
      });
      params.delete('meta_err');
      const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', url);
    }
    if (params.has('reddit')) {
      toast({
        title: 'Reddit connected',
        description: 'Posts will go to your u/profile by default. Change the target below if you want a subreddit.',
      });
      params.delete('reddit');
      const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', url);
      load();
    } else if (params.has('reddit_err')) {
      toast({
        title: 'Reddit connection failed',
        description: params.get('reddit_err') || 'unknown error',
      });
      params.delete('reddit_err');
      const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', url);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            Platform connections
          </DialogTitle>
          <DialogDescription>
            Connect a platform to enable direct posting. Anything not connected here is published
            via copy-to-clipboard with a deep link to the platform's compose page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Meta (Facebook Page + Instagram) card */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-emerald-100 flex items-center gap-2">
                  <Facebook className="w-4 h-4" />
                  <Instagram className="w-4 h-4" />
                  Meta (Facebook Page + Instagram)
                  {(facebookPages.length > 0 || igAccounts.length > 0) && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-bold">
                      <Check className="inline w-3 h-3 mr-0.5" />
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-200/70 mt-1">
                  One OAuth flow connects both.
                </p>
                <p className="text-xs text-emerald-200/60 mt-2 leading-relaxed">
                  <span className="text-amber-300 font-semibold">Instagram personal accounts cannot be auto-posted.</span>{' '}
                  Meta's Graph API only supports Instagram Business or Creator accounts, and each must be
                  linked to a Facebook Page you control. Switching is free and instant: in the IG mobile app
                  open Settings → Account → Switch to professional account → pick Creator or Business → link
                  to your Facebook Page. Your followers, posts, and handle stay the same.
                </p>
              </div>
            </div>

            {(facebookPages.length > 0 || igAccounts.length > 0) && (
              <div className="space-y-2 mb-3">
                {facebookPages.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm rounded bg-emerald-900/30 px-2 py-1.5">
                    <span className="text-emerald-100">
                      <Facebook className="inline w-3.5 h-3.5 mr-1 text-blue-400" />
                      {c.account_handle}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => handleDisconnect(c, c.account_handle)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {igAccounts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm rounded bg-emerald-900/30 px-2 py-1.5">
                    <span className="text-emerald-100">
                      <Instagram className="inline w-3.5 h-3.5 mr-1 text-pink-400" />
                      @{c.account_handle}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => handleDisconnect(c, `@${c.account_handle}`)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleConnectMeta}
              disabled={metaStarting}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {metaStarting ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Redirecting…</>
              ) : (
                <>
                  <Facebook className="w-4 h-4 mr-1.5" />
                  {(facebookPages.length > 0 || igAccounts.length > 0) ? 'Reconnect Meta' : 'Connect with Facebook'}
                </>
              )}
            </Button>
          </div>

          {/* Bluesky card */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-emerald-100 flex items-center gap-2">
                  Bluesky
                  {bluesky && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-bold">
                      <Check className="inline w-3 h-3 mr-0.5" />
                      Connected
                    </span>
                  )}
                </div>
                {bluesky && (
                  <div className="text-xs text-emerald-200/70 mt-0.5">
                    @{bluesky.account_handle}
                  </div>
                )}
              </div>
              {bluesky && (
                <Button size="sm" variant="ghost" onClick={() => handleDisconnect(bluesky, 'Bluesky')}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              )}
            </div>

            {!bluesky && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Handle</Label>
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="yourhandle.bsky.social"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">App password</Label>
                  <Input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    className="text-sm font-mono"
                  />
                  <p className="text-xs text-emerald-200/60 mt-1">
                    Generate one at{' '}
                    <a
                      href="https://bsky.app/settings/app-passwords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 underline inline-flex items-center gap-0.5"
                    >
                      bsky.app/settings/app-passwords
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    . This is NOT your main Bluesky password.
                  </p>
                </div>
                <Button
                  onClick={handleSaveBluesky}
                  disabled={saving || loading}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</> : 'Connect Bluesky'}
                </Button>
              </div>
            )}
          </div>

          {/* Reddit card. OAuth flow with permanent refresh token so the
              connection stays alive. Default target is the user's own
              u/profile; they can change it to a subreddit, but bear in
              mind most subreddits auto-remove bot-flagged posts. */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-emerald-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-orange-400" />
                  Reddit
                  {reddit && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-bold">
                      <Check className="inline w-3 h-3 mr-0.5" />
                      Connected
                    </span>
                  )}
                </div>
                {reddit && (
                  <div className="text-xs text-emerald-200/70 mt-0.5">u/{reddit.account_handle}</div>
                )}
                <p className="text-xs text-emerald-200/70 mt-1">
                  Free OAuth. Posts text content directly. No hashtags (Reddit doesn't use them).
                </p>
              </div>
              {reddit && (
                <Button size="sm" variant="ghost" onClick={() => handleDisconnect(reddit, 'Reddit')}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Disconnect
                </Button>
              )}
            </div>

            {reddit ? (
              <div className="space-y-2">
                <Label className="text-xs">Target subreddit</Label>
                <div className="flex gap-2">
                  <Input
                    value={redditSubreddit}
                    onChange={(e) => setRedditSubreddit(e.target.value)}
                    placeholder={`u_${reddit.account_handle}`}
                    className="text-xs font-mono"
                  />
                  <Button size="sm" onClick={handleSaveRedditSubreddit}>
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-emerald-200/60">
                  Use <code className="text-emerald-300">u_yourname</code> for your own profile (safest, no
                  subreddit rules), or a subreddit slug like <code className="text-emerald-300">CrestedGecko</code>.
                  Note: many subreddits auto-remove bot-flagged or promotional posts; your profile is the
                  reliable default.
                </p>
              </div>
            ) : (
              <Button
                onClick={handleConnectReddit}
                disabled={redditStarting}
                className="bg-orange-600 hover:bg-orange-500"
              >
                {redditStarting
                  ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Redirecting…</>
                  : <><MessageSquare className="w-4 h-4 mr-1.5" /> Connect Reddit</>}
              </Button>
            )}
          </div>

          {/* Other platforms — clipboard-only for now */}
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-sm text-emerald-200/60">
            <div className="flex items-center justify-between">
              <span>Threads, X, TikTok, YouTube</span>
              <span className="text-xs">Copy-to-clipboard with deep links</span>
            </div>
            <div className="text-[11px] mt-1 text-emerald-200/50">
              X needs a $200/mo paid API tier. TikTok and YouTube Community don't expose public posting
              APIs. Threads will join Meta once Meta's review approves the Threads scope.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
