import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Store, Save, Loader2, ExternalLink, ArrowLeft, Plus, X, Lock, Crown, GitBranch,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { tierOf } from '@/lib/tierLimits';
import {
    LINK_KINDS, linkKindMeta, normalizeSlug, SLUG_RE,
    SLUG_COOLDOWN_DAYS, slugCooldownRemaining,
} from '@/lib/storeLinks';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

const MIN_BANNER_WIDTH = 1280;
const MIN_BANNER_HEIGHT = 320;

const STORE_POLICY_EXAMPLE = [
    "Shipping: Live arrival guaranteed. Ships FedEx Priority Overnight, Mon-Wed only. Shipping cost is the buyer's responsibility.",
    '',
    'Payment Plans: 50% non-refundable deposit required to reserve. Remaining balance due before shipping.',
    '',
    'Health Guarantee: 7-day health guarantee from the date of arrival. Buyer must send unboxing photos within 24 hours of delivery.',
    '',
    'Returns: No returns after 7 days. All sales final once the gecko has been feeding for the buyer.',
    '',
    'Weight Minimum: Hatchlings will not ship under 3g, or under the target weight specified at reservation.',
].join('\n');

function ImageDimensionsHint({ url }) {
    const [info, setInfo] = useState(null);
    useEffect(() => {
        setInfo(null);
        if (!url) return;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setInfo({ w: img.naturalWidth, h: img.naturalHeight, ok: true });
        };
        img.onerror = () => {
            if (!cancelled) setInfo({ ok: false });
        };
        img.src = url;
        return () => { cancelled = true; };
    }, [url]);

    if (!info) return <p className="text-xs text-slate-500">Checking image...</p>;
    if (!info.ok) return <p className="text-xs text-amber-400">Could not load that URL. Double-check it's a direct link to an image.</p>;
    const tooSmall = info.w < MIN_BANNER_WIDTH || info.h < MIN_BANNER_HEIGHT;
    return (
        <p className={`text-xs ${tooSmall ? 'text-amber-400' : 'text-emerald-400'}`}>
            Your image is {info.w} x {info.h} px.
            {tooSmall
                ? ` Below the ${MIN_BANNER_WIDTH} x ${MIN_BANNER_HEIGHT} minimum, so it may look blurry on larger screens.`
                : ' Looks good for the banner area.'}
        </p>
    );
}

const EMPTY_FORM = {
    slug: '',
    title: '',
    tagline: '',
    description: '',
    header_image_url: '',
    contact_link: '',
    policies: '',
    external_links: [],
    featured_gecko_ids: [],
    featured_breeding_plan_ids: [],
    is_published: false,
};

function defaultSlugFor(user) {
    return normalizeSlug(user?.breeder_name || user?.full_name || user?.email?.split('@')[0] || '');
}

function defaultTitleFor(user) {
    return user?.breeder_name || user?.full_name || '';
}

export default function MyStore() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [geckos, setGeckos] = useState([]);
    const [plans, setPlans] = useState([]);

    const tier = tierOf(user);
    const hasPerk =
        tier === 'breeder' ||
        tier === 'enterprise' ||
        user?.subscription_status === 'grandfathered';

    useEffect(() => {
        if (!user?.email) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [pageRes, geckoRes, planRes] = await Promise.all([
                supabase
                    .from('breeder_store_pages')
                    .select('*')
                    .eq('owner_email', user.email)
                    .maybeSingle(),
                supabase
                    .from('geckos')
                    .select('id, name, morphs_traits, image_urls, status, sex, is_public, archived')
                    .eq('created_by', user.email)
                    .eq('archived', false),
                supabase
                    .from('breeding_plans')
                    .select('id, sire_id, dam_id, pairing_date, status, is_public, archived')
                    .eq('created_by', user.email)
                    .eq('archived', false),
            ]);
            if (cancelled) return;
            const existing = pageRes.data;
            if (existing) {
                setPage(existing);
                setForm({
                    slug: existing.slug || '',
                    title: existing.title || '',
                    tagline: existing.tagline || '',
                    description: existing.description || '',
                    header_image_url: existing.header_image_url || '',
                    contact_link: existing.contact_link || '',
                    policies: existing.policies || '',
                    external_links: Array.isArray(existing.external_links) ? existing.external_links : [],
                    featured_gecko_ids: Array.isArray(existing.featured_gecko_ids) ? existing.featured_gecko_ids : [],
                    featured_breeding_plan_ids: Array.isArray(existing.featured_breeding_plan_ids) ? existing.featured_breeding_plan_ids : [],
                    is_published: !!existing.is_published,
                });
            } else {
                setForm((prev) => ({
                    ...prev,
                    slug: defaultSlugFor(user),
                    title: defaultTitleFor(user),
                }));
            }
            setGeckos(Array.isArray(geckoRes.data) ? geckoRes.data : []);
            setPlans(Array.isArray(planRes.data) ? planRes.data : []);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [user?.email]);

    const cooldownDays = useMemo(() => slugCooldownRemaining(page), [page]);
    const slugLocked = cooldownDays > 0 && page?.slug && form.slug !== page.slug;
    const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    const toggleGecko = (id) => {
        setForm((prev) => {
            const has = prev.featured_gecko_ids.includes(id);
            return {
                ...prev,
                featured_gecko_ids: has
                    ? prev.featured_gecko_ids.filter((x) => x !== id)
                    : [...prev.featured_gecko_ids, id],
            };
        });
    };
    const togglePlan = (id) => {
        setForm((prev) => {
            const has = prev.featured_breeding_plan_ids.includes(id);
            return {
                ...prev,
                featured_breeding_plan_ids: has
                    ? prev.featured_breeding_plan_ids.filter((x) => x !== id)
                    : [...prev.featured_breeding_plan_ids, id],
            };
        });
    };

    const addLink = () => {
        setForm((prev) => ({
            ...prev,
            external_links: [...prev.external_links, { kind: 'morphmarket', label: '', url: '' }],
        }));
    };
    const updateLink = (idx, patch) => {
        setForm((prev) => ({
            ...prev,
            external_links: prev.external_links.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
        }));
    };
    const removeLink = (idx) => {
        setForm((prev) => ({
            ...prev,
            external_links: prev.external_links.filter((_, i) => i !== idx),
        }));
    };

    const save = async () => {
        const slug = normalizeSlug(form.slug);
        if (!slug || !SLUG_RE.test(slug)) {
            toast({ title: 'Pick a URL', description: 'Lowercase letters, numbers, and dashes only.', variant: 'destructive' });
            return;
        }
        if (!form.title.trim()) {
            toast({ title: 'Give your store a name', description: 'This shows as the page heading.', variant: 'destructive' });
            return;
        }

        // Slug change cooldown: first change is free, subsequent ones are
        // rate-limited so external backlinks don't break weekly.
        const slugChanged = page?.slug && slug !== page.slug;
        if (slugChanged && cooldownDays > 0) {
            toast({
                title: 'URL change is on cooldown',
                description: `You can change your store URL again in ${cooldownDays} day${cooldownDays === 1 ? '' : 's'}.`,
                variant: 'destructive',
            });
            return;
        }

        // Drop links that have an empty URL so the picker doesn't have to
        // be over-careful about empty rows.
        const cleanedLinks = (form.external_links || [])
            .map((l) => ({
                kind: l.kind || 'other',
                label: (l.label || '').trim() || linkKindMeta(l.kind).label,
                url: (l.url || '').trim(),
            }))
            .filter((l) => l.url);

        setSaving(true);
        const nowIso = new Date().toISOString();
        const payload = {
            owner_email: user.email,
            slug,
            title: form.title.trim(),
            tagline: form.tagline.trim() || null,
            description: form.description.trim() || null,
            header_image_url: form.header_image_url.trim() || null,
            contact_link: form.contact_link.trim() || null,
            policies: form.policies.trim() || null,
            external_links: cleanedLinks,
            featured_gecko_ids: form.featured_gecko_ids,
            featured_breeding_plan_ids: form.featured_breeding_plan_ids,
            is_published: form.is_published,
            updated_date: nowIso,
        };
        if (slugChanged) {
            payload.slug_changed_at = nowIso;
            payload.slug_change_count = (page?.slug_change_count || 0) + 1;
        }
        const res = page?.id
            ? await supabase.from('breeder_store_pages').update(payload).eq('id', page.id).select().single()
            : await supabase.from('breeder_store_pages').insert(payload).select().single();
        if (res.error) {
            const msg = res.error.message?.includes('duplicate') && res.error.message?.includes('slug')
                ? 'That URL is already taken. Pick another.'
                : res.error.message || 'Save failed.';
            toast({ title: 'Could not save', description: msg, variant: 'destructive' });
        } else {
            setPage(res.data);
            setForm((prev) => ({ ...prev, slug: res.data.slug, external_links: res.data.external_links || [] }));
            toast({
                title: 'Saved',
                description: form.is_published ? 'Your store is live.' : 'Saved as a draft.',
            });
        }
        setSaving(false);
    };

    if (!user) return null;

    if (!hasPerk) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-900 text-slate-100">
                <div className="max-w-2xl mx-auto p-6 pt-16">
                    <Card className="bg-slate-900/60 border-emerald-700/40">
                        <CardHeader>
                            <CardTitle className="text-emerald-200 flex items-center gap-2">
                                <Crown className="w-5 h-5" /> Store pages are a Breeder perk
                            </CardTitle>
                            <CardDescription className="text-slate-300">
                                Breeder and Enterprise members can publish a dedicated store page on Geck Inspect,
                                with a custom URL like <code className="text-emerald-300">geckinspect.com/store/your-name</code>,
                                a featured stock grid, policies, and one-click links to MorphMarket, PalmStreet, and your socials.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                                <Link to={createPageUrl('Membership')}>See plans</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-900 text-slate-100">
            <Helmet><title>My Store - Geck Inspect</title></Helmet>
            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
                {/* Hero */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div className="space-y-2">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(createPageUrl('Dashboard'))}
                            className="text-slate-400 hover:text-emerald-300 -ml-2 h-8 px-2"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
                        </Button>
                        <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                            <Store className="w-8 h-8 text-emerald-400" /> My Store
                        </h1>
                        <p className="text-slate-300 max-w-xl">
                            A customer-facing storefront for your breeding operation. Pick the geckos and pairs
                            you want to show off, write your bio and policies, and share one link anywhere you sell.
                        </p>
                    </div>
                    {page?.slug && (
                        <Button
                            asChild
                            variant="outline"
                            className="border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/40"
                        >
                            <a href={`/store/${page.slug}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View live store
                            </a>
                        </Button>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-slate-400 py-12 justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading your store
                    </div>
                ) : (
                    <>
                        {/* Identity */}
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-slate-100 text-lg">Identity</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Your store URL and headline. We pre-fill the URL with your breeder name. The first
                                    change is free; after that, edits are limited to once every {SLUG_COOLDOWN_DAYS} days
                                    so links you share don't break.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="store-slug" className="text-slate-200">Store URL</Label>
                                    <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
                                        <span className="text-slate-500 text-sm shrink-0">geckinspect.com/store/</span>
                                        <Input
                                            id="store-slug"
                                            value={form.slug}
                                            onChange={(e) => set('slug', normalizeSlug(e.target.value))}
                                            placeholder="your-breeder-name"
                                            disabled={cooldownDays > 0}
                                            className="bg-transparent border-0 focus-visible:ring-0 px-0 h-7 text-emerald-200"
                                        />
                                    </div>
                                    {slugLocked && (
                                        <p className="text-xs text-amber-300 flex items-center gap-1">
                                            <Lock className="w-3 h-3" />
                                            URL change is on cooldown. {cooldownDays} day{cooldownDays === 1 ? '' : 's'} left.
                                        </p>
                                    )}
                                    {!slugLocked && page?.slug_change_count > 0 && (
                                        <p className="text-xs text-slate-500">
                                            You've changed this URL {page.slug_change_count} time{page.slug_change_count === 1 ? '' : 's'}.
                                            Next change locks the URL for {SLUG_COOLDOWN_DAYS} days.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="store-title" className="text-slate-200">Store name</Label>
                                    <Input
                                        id="store-title"
                                        value={form.title}
                                        onChange={(e) => set('title', e.target.value)}
                                        placeholder="Sunbeam Crested Geckos"
                                        className="bg-slate-950/60 border-slate-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="store-tagline" className="text-slate-200">Tagline</Label>
                                    <Input
                                        id="store-tagline"
                                        value={form.tagline}
                                        onChange={(e) => set('tagline', e.target.value)}
                                        placeholder="Boutique Lilly White and Cappuccino crosses out of Boise, ID"
                                        className="bg-slate-950/60 border-slate-700"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* About + header image */}
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-slate-100 text-lg">About</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Your bio and a hero image at the top of the page.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="store-header" className="text-slate-200">Header image URL</Label>
                                    <Input
                                        id="store-header"
                                        value={form.header_image_url}
                                        onChange={(e) => set('header_image_url', e.target.value)}
                                        placeholder="https://..."
                                        className="bg-slate-950/60 border-slate-700"
                                    />
                                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                                        <p className="text-xs text-slate-300 font-medium">Banner sizing</p>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            The banner renders full-width at roughly
                                            <span className="text-slate-300"> 320px tall on desktop</span> and
                                            <span className="text-slate-300"> 224px tall on mobile</span>,
                                            center-cropped to fit. Keep the focal point near the middle.
                                        </p>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            <span className="text-slate-300">Recommended: 1920 x 480</span> (4:1 ratio).
                                            Below <span className="text-slate-300">{MIN_BANNER_WIDTH} x {MIN_BANNER_HEIGHT}</span> will
                                            look soft on larger screens.
                                        </p>
                                        {form.header_image_url && (
                                            <ImageDimensionsHint url={form.header_image_url} />
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="store-description" className="text-slate-200">Bio</Label>
                                    <Textarea
                                        id="store-description"
                                        value={form.description}
                                        onChange={(e) => set('description', e.target.value)}
                                        rows={6}
                                        placeholder="What you breed, what you're known for, how long you've been at it."
                                        className="bg-slate-950/60 border-slate-700"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Featured geckos */}
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
                                    Featured geckos
                                    <span className="text-xs font-normal text-slate-500">
                                        ({form.featured_gecko_ids.length} selected)
                                    </span>
                                </CardTitle>
                                <CardDescription className="text-slate-400">
                                    Pick the geckos you want to show off at the top of your storefront. Only geckos
                                    marked public in your collection appear here.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {geckos.filter((g) => g.is_public).length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">
                                        You have no public geckos yet. Mark a gecko as public in your collection and it
                                        will show up here.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {geckos.filter((g) => g.is_public).map((g) => {
                                            const selected = form.featured_gecko_ids.includes(g.id);
                                            const img = g.image_urls?.[0] || DEFAULT_GECKO_IMAGE;
                                            return (
                                                <button
                                                    type="button"
                                                    key={g.id}
                                                    onClick={() => toggleGecko(g.id)}
                                                    className={`text-left rounded-lg overflow-hidden border transition-all ${
                                                        selected
                                                            ? 'border-emerald-400 ring-2 ring-emerald-400/40'
                                                            : 'border-slate-700 hover:border-slate-500'
                                                    }`}
                                                >
                                                    <div className="aspect-square bg-slate-800 relative">
                                                        <img src={img} alt={g.name} className="w-full h-full object-cover" />
                                                        {selected && (
                                                            <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                                {form.featured_gecko_ids.indexOf(g.id) + 1}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-2 bg-slate-900/80">
                                                        <p className="text-xs font-semibold text-slate-100 truncate">{g.name}</p>
                                                        {g.morphs_traits && (
                                                            <p className="text-[10px] text-slate-400 truncate">{g.morphs_traits}</p>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Featured breeding pairs */}
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-slate-100 text-lg flex items-center gap-2">
                                    <GitBranch className="w-5 h-5 text-pink-400" /> Featured breeding pairs
                                    <span className="text-xs font-normal text-slate-500">
                                        ({form.featured_breeding_plan_ids.length} selected)
                                    </span>
                                </CardTitle>
                                <CardDescription className="text-slate-400">
                                    Public pairings you want to highlight on your storefront.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {plans.filter((p) => p.is_public).length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">
                                        You have no public breeding plans yet. Mark a plan as public and it will show up here.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {plans.filter((p) => p.is_public).map((p) => {
                                            const selected = form.featured_breeding_plan_ids.includes(p.id);
                                            const sire = geckos.find((g) => g.id === p.sire_id);
                                            const dam = geckos.find((g) => g.id === p.dam_id);
                                            const pairLabel = [sire?.name, dam?.name].filter(Boolean).join(' x ') || 'Pairing';
                                            return (
                                                <button
                                                    type="button"
                                                    key={p.id}
                                                    onClick={() => togglePlan(p.id)}
                                                    className={`text-left rounded-lg border p-3 transition-colors ${
                                                        selected
                                                            ? 'border-pink-400 bg-pink-500/10'
                                                            : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-medium text-slate-100 text-sm truncate">{pairLabel}</p>
                                                        {selected && (
                                                            <span className="text-[10px] font-bold bg-pink-500 text-white rounded-full px-2 py-0.5">
                                                                #{form.featured_breeding_plan_ids.indexOf(p.id) + 1}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {p.status && (
                                                        <p className="text-xs text-slate-400 mt-1 capitalize">{p.status.replace(/_/g, ' ')}</p>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Policies */}
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-slate-100 text-lg">Policies</CardTitle>
                                        <CardDescription className="text-slate-400">
                                            Shipping, health guarantee, holds, returns, and anything else a buyer should know
                                            before they reach out.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2.5 text-xs border-emerald-700/60 bg-emerald-900/20 text-emerald-200 hover:bg-emerald-900/40 hover:text-emerald-100 shrink-0"
                                        onClick={() => {
                                            const hasContent = (form.policies || '').trim().length > 0;
                                            if (hasContent && !window.confirm('Replace your current policy with the example template?')) return;
                                            set('policies', STORE_POLICY_EXAMPLE);
                                        }}
                                    >
                                        Use example template
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={form.policies}
                                    onChange={(e) => set('policies', e.target.value)}
                                    rows={6}
                                    placeholder="Click 'Use example template' above to start with a sample, or write your own here."
                                    className="bg-slate-950/60 border-slate-700"
                                />
                            </CardContent>
                        </Card>

                        {/* Contact + external links */}
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-slate-100 text-lg">Contact and links</CardTitle>
                                <CardDescription className="text-slate-400">
                                    A primary get-in-touch button plus any external platforms you sell on or post to.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="store-contact" className="text-slate-200">Get-in-touch link</Label>
                                    <Input
                                        id="store-contact"
                                        value={form.contact_link}
                                        onChange={(e) => set('contact_link', e.target.value)}
                                        placeholder="mailto:you@example.com or https://instagram.com/..."
                                        className="bg-slate-950/60 border-slate-700"
                                    />
                                    <p className="text-xs text-slate-500">Renders as the primary CTA button.</p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-slate-200">External links</Label>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={addLink}
                                            className="border-slate-700 text-slate-200 hover:bg-slate-800 h-8"
                                        >
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Add link
                                        </Button>
                                    </div>
                                    {form.external_links.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">
                                            Add your MorphMarket, PalmStreet, or socials so buyers can find you everywhere.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {form.external_links.map((link, idx) => (
                                                <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/40 p-2">
                                                    <Select
                                                        value={link.kind}
                                                        onValueChange={(v) => updateLink(idx, { kind: v })}
                                                    >
                                                        <SelectTrigger className="w-36 bg-slate-900 border-slate-700 text-sm h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                                            {LINK_KINDS.map((k) => (
                                                                <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        value={link.url}
                                                        onChange={(e) => updateLink(idx, { url: e.target.value })}
                                                        placeholder={linkKindMeta(link.kind).placeholder}
                                                        className="flex-1 min-w-0 bg-slate-900/60 border-slate-700 h-9"
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => removeLink(idx)}
                                                        className="text-slate-400 hover:text-red-400 h-9 w-9"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Publish + save */}
                        <Card className="bg-slate-900/60 border-emerald-700/40">
                            <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                                <div className="flex items-center gap-4">
                                    <Switch
                                        checked={form.is_published}
                                        onCheckedChange={(v) => set('is_published', v)}
                                    />
                                    <div>
                                        <p className="text-slate-100 font-medium">Publish my store</p>
                                        <p className="text-xs text-slate-400">When off, only you can preview the page.</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={save}
                                    disabled={saving}
                                    size="lg"
                                    className="bg-emerald-600 hover:bg-emerald-500"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save store
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
