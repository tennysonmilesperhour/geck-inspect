import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Users2,
  Plus,
  Trash2,
  Copy,
  Loader2,
  Check,
  Crown,
  ArrowRight,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Collection, CollectionMember } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { getTierLimits } from '@/lib/tierLimits';

/**
 * Best-effort transactional email via the send-collection-invite edge
 * function. Never throws: if the function isn't deployed yet (404),
 * isn't configured (200 with `skipped`), or the network blip's, we
 * fall through to the copy-link UI which is already there. The
 * pending row is the source of truth for the invite either way.
 */
async function sendInviteEmail({ toEmail, inviter, collectionName, role, token }) {
  const inviteUrl = `${window.location.origin}/collection-invite/${token}`;
  try {
    const { data, error } = await supabase.functions.invoke('send-collection-invite', {
      body: {
        to_email: toEmail,
        inviter_email: inviter?.email || '',
        inviter_name: inviter?.full_name || '',
        collection_name: collectionName,
        role,
        invite_url: inviteUrl,
      },
    });
    if (error) return { delivered: false, reason: error.message };
    if (data?.delivered === 1) return { delivered: true };
    return { delivered: false, reason: data?.skipped || 'unknown' };
  } catch (e) {
    return { delivered: false, reason: e?.message || 'network' };
  }
}

/**
 * Settings card: list and manage collections you own + collaborator
 * memberships. Supports inviting collaborators per collection within
 * your tier's collaborator cap.
 *
 * Tier policy:
 *   - Free:    up to maxCollaborators (default 1) accepted+pending invites
 *   - Keeper:  up to maxCollaborators (default 5) accepted+pending invites
 *              across all owned collections combined
 *   - Breeder: unlimited
 */

function generateToken() {
  const arr = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function inviteUrl(token) {
  if (typeof window === 'undefined') return `/collection-invite/${token}`;
  return `${window.location.origin}/collection-invite/${token}`;
}

export default function CollectionsCard({ user }) {
  const [collections, setCollections] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const { toast } = useToast();

  const limits = getTierLimits(user);
  const collabCap = limits.maxCollaborators;
  const totalActiveCollabs = memberships.filter(
    (m) => m.role !== 'owner' && (m.status === 'pending' || m.status === 'accepted'),
  ).length;
  const atCap = collabCap != null && totalActiveCollabs >= collabCap;

  const load = async () => {
    setLoading(true);
    try {
      const email = user?.email;
      if (!email) {
        setCollections([]);
        setMemberships([]);
        return;
      }
      // Collections RLS limits these to ones the caller owns or is a
      // member of, so we don't need an explicit owner_email filter.
      const [cols, mems] = await Promise.all([
        Collection.filter({}, 'created_at'),
        CollectionMember.filter({}, 'invited_at'),
      ]);
      setCollections(Array.isArray(cols) ? cols : []);
      setMemberships(Array.isArray(mems) ? mems : []);
    } catch (e) {
      console.error('CollectionsCard load failed', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.email]);

  const createCollection = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await Collection.create({
        owner_email: user.email,
        name,
        description: null,
        is_default: false,
      });
      // Insert owner membership row so this collection can be queried
      // uniformly via collection_members.
      await CollectionMember.create({
        collection_id: created.id,
        member_email: user.email,
        role: 'owner',
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      });
      setNewName('');
      await load();
      toast({ title: 'Collection created' });
    } catch (e) {
      toast({
        title: 'Could not create collection',
        description: e.message,
        variant: 'destructive',
      });
    }
    setCreating(false);
  };

  const removeCollection = async (col) => {
    if (col.is_default) {
      toast({
        title: 'Default collection cannot be deleted',
        description: 'Move or delete the geckos inside it first, then create a new default collection.',
        variant: 'destructive',
      });
      return;
    }
    if (!confirm(`Delete collection "${col.name}" and all its memberships? Geckos in this collection will be unparented (you can reassign them later).`)) {
      return;
    }
    try {
      await Collection.delete(col.id);
      await load();
      toast({ title: 'Collection deleted' });
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Users2 className="w-5 h-5" />
          Collections &amp; collaborators
        </CardTitle>
        <CardDescription className="text-slate-400">
          Group your geckos into named collections and invite other keepers to
          help manage them.{' '}
          {collabCap == null
            ? 'Your plan supports unlimited collaborators.'
            : collabCap === 0
              ? 'Your plan does not include collaborators ,  upgrade to invite people.'
              : `Your plan includes up to ${collabCap} active collaborator${collabCap === 1 ? '' : 's'}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {collections.length === 0 ? (
              <p className="text-sm text-slate-400">
                You don&rsquo;t own any collections yet. Adding your first
                gecko will create your default collection automatically.
              </p>
            ) : (
              <ul className="space-y-3">
                {collections.map((col) => (
                  <CollectionRow
                    key={col.id}
                    user={user}
                    collection={col}
                    memberships={memberships.filter((m) => m.collection_id === col.id)}
                    atCap={atCap}
                    collabCap={collabCap}
                    totalActiveCollabs={totalActiveCollabs}
                    onChange={load}
                    onDelete={() => removeCollection(col)}
                  />
                ))}
              </ul>
            )}

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <Label className="text-slate-300 text-xs uppercase tracking-wider">
                New collection
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Project: Lilly White × Phantom"
                  className="bg-slate-800 border-slate-600 text-slate-100"
                />
                <Button
                  onClick={createCollection}
                  disabled={creating || !newName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create
                    </>
                  )}
                </Button>
              </div>
            </div>

            {collabCap === 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm text-emerald-200 font-semibold">
                    Want to share your collection?
                  </p>
                  <p className="text-xs text-emerald-200/70 mt-1">
                    Upgrade to Keeper to add up to 2 collaborators, or Breeder
                    for unlimited.
                  </p>
                </div>
                <Link to={createPageUrl('Subscription')}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40"
                  >
                    Upgrade
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CollectionRow({
  user,
  collection,
  memberships,
  atCap,
  collabCap,
  onChange,
  onDelete,
}) {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const owner = memberships.find((m) => m.role === 'owner');
  const others = memberships.filter((m) => m.role !== 'owner');

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: 'Invalid email',
        description: 'Enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }
    if (collabCap === 0) {
      toast({
        title: 'Upgrade required',
        description: 'Your current plan does not include collaborators.',
        variant: 'destructive',
      });
      return;
    }
    if (atCap) {
      toast({
        title: 'Collaborator limit reached',
        description: `Your plan supports ${collabCap} active collaborator${collabCap === 1 ? '' : 's'}. Revoke an existing invite or upgrade.`,
        variant: 'destructive',
      });
      return;
    }
    setInviting(true);
    try {
      const token = generateToken();
      await CollectionMember.create({
        collection_id: collection.id,
        member_email: email,
        role: inviteRole,
        status: 'pending',
        invite_token: token,
        invited_by_email: user.email,
        invited_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      });
      // Fire-and-await the transactional email. Failures fall back to
      // the existing copy-link UX, so this never blocks the invite.
      const emailResult = await sendInviteEmail({
        toEmail: email,
        inviter: user,
        collectionName: collection.name,
        role: inviteRole,
        token,
      });
      setInviteEmail('');
      onChange?.();
      toast({
        title: emailResult.delivered ? 'Invite sent' : 'Invite created',
        description: emailResult.delivered
          ? `Email sent to ${email}.`
          : `Email delivery isn't set up yet ,  copy the invite link below to share manually.`,
      });
    } catch (e) {
      toast({
        title: 'Could not create invite',
        description: e.message,
        variant: 'destructive',
      });
    }
    setInviting(false);
  };

  const revokeMember = async (m) => {
    if (!confirm(`Revoke ${m.member_email} from "${collection.name}"?`)) return;
    try {
      await CollectionMember.delete(m.id);
      onChange?.();
    } catch (e) {
      toast({
        title: 'Revoke failed',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const resendInvite = async (m) => {
    setResendingId(m.id);
    const result = await sendInviteEmail({
      toEmail: m.member_email,
      inviter: user,
      collectionName: collection.name,
      role: m.role,
      token: m.invite_token,
    });
    setResendingId(null);
    toast({
      title: result.delivered ? 'Invite re-sent' : 'Could not re-send email',
      description: result.delivered
        ? `Email sent to ${m.member_email}.`
        : 'Use the Copy invite link below to share manually.',
      variant: result.delivered ? 'default' : 'destructive',
    });
  };

  const copyInvite = async (m) => {
    try {
      await navigator.clipboard?.writeText(inviteUrl(m.invite_token));
      setCopiedToken(m.id);
      setTimeout(() => setCopiedToken(null), 1500);
    } catch {
      toast({
        title: 'Could not copy',
        description: inviteUrl(m.invite_token),
      });
    }
  };

  return (
    <li className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-white">{collection.name}</span>
            {collection.is_default && (
              <Badge className="bg-emerald-700 text-emerald-100 text-[10px]">
                Default
              </Badge>
            )}
            <span className="text-xs text-slate-500">
              {others.length} collaborator{others.length === 1 ? '' : 's'}
            </span>
          </div>
          {owner && (
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-amber-300" />
              Owner: {owner.member_email}
            </div>
          )}
        </div>
        {!collection.is_default && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-slate-400 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {others.length > 0 && (
        <ul className="space-y-1.5">
          {others.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700/60 text-sm"
            >
              <div className="min-w-0">
                <div className="text-slate-200 truncate">{m.member_email}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <span className="capitalize">{m.role}</span>
                  <span>·</span>
                  <Badge
                    className={
                      m.status === 'accepted'
                        ? 'bg-emerald-700 text-emerald-100 text-[10px]'
                        : m.status === 'pending'
                          ? 'bg-amber-700 text-amber-100 text-[10px]'
                          : 'bg-slate-700 text-slate-300 text-[10px]'
                    }
                  >
                    {m.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {m.status === 'pending' && m.invite_token && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resendInvite(m)}
                      disabled={resendingId === m.id}
                      className="text-slate-400 hover:text-emerald-300 text-xs"
                      title="Re-send the invitation email"
                    >
                      {resendingId === m.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1" />
                          Resend
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInvite(m)}
                      className="text-slate-400 hover:text-emerald-300 text-xs"
                    >
                      {copiedToken === m.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copy link
                        </>
                      )}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeMember(m)}
                  className="text-slate-400 hover:text-red-300 h-8 w-8"
                  title="Revoke"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {collabCap !== 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 pt-1">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="invite by email"
            className="bg-slate-800 border-slate-600 text-slate-100"
            type="email"
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={sendInvite}
            disabled={inviting || atCap}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {inviting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Invite</>
            )}
          </Button>
        </div>
      )}
    </li>
  );
}
