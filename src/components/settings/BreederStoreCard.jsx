import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Store, ExternalLink, Save, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';

const SLUG_RE = /^[a-z0-9-]+$/;
const MIN_BANNER_WIDTH = 1280;
const MIN_BANNER_HEIGHT = 320;

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

    if (!info) return <p className="text-xs text-slate-500">Checking image…</p>;
    if (!info.ok) return <p className="text-xs text-amber-400">Could not load that URL. Double-check it's a direct link to an image.</p>;
    const tooSmall = info.w < MIN_BANNER_WIDTH || info.h < MIN_BANNER_HEIGHT;
    return (
        <p className={`text-xs ${tooSmall ? 'text-amber-400' : 'text-emerald-400'}`}>
            Your image is {info.w} × {info.h} px.
            {tooSmall
                ? ` Below the ${MIN_BANNER_WIDTH} × ${MIN_BANNER_HEIGHT} minimum, so it may look blurry on larger screens.`
                : ' Looks good for the banner area.'}
        </p>
    );
}

function normalizeSlug(raw) {
    return (raw || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export default function BreederStoreCard({ userEmail }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState(null);
    const [form, setForm] = useState({
        slug: '',
        title: '',
        tagline: '',
        description: '',
        header_image_url: '',
        contact_link: '',
        secondary_link: '',
        is_published: false,
    });

    useEffect(() => {
        if (!userEmail) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            const { data } = await supabase
                .from('breeder_store_pages')
                .select('*')
                .eq('owner_email', userEmail)
                .maybeSingle();
            if (cancelled) return;
            if (data) {
                setPage(data);
                setForm({
                    slug: data.slug,
                    title: data.title || '',
                    tagline: data.tagline || '',
                    description: data.description || '',
                    header_image_url: data.header_image_url || '',
                    contact_link: data.contact_link || '',
                    secondary_link: data.secondary_link || '',
                    is_published: !!data.is_published,
                });
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [userEmail]);

    const handle = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    const save = async () => {
        const slug = normalizeSlug(form.slug);
        if (!slug || !SLUG_RE.test(slug)) {
            toast({ title: 'Pick a URL slug', description: 'Lowercase letters, numbers, and dashes only.', variant: 'destructive' });
            return;
        }
        if (!form.title.trim()) {
            toast({ title: 'Give your store a title', description: 'This shows as the page heading.', variant: 'destructive' });
            return;
        }
        setSaving(true);
        const payload = {
            owner_email: userEmail,
            slug,
            title: form.title.trim(),
            tagline: form.tagline.trim() || null,
            description: form.description.trim() || null,
            header_image_url: form.header_image_url.trim() || null,
            contact_link: form.contact_link.trim() || null,
            secondary_link: form.secondary_link.trim() || null,
            is_published: form.is_published,
            updated_date: new Date().toISOString(),
        };
        let res;
        if (page?.id) {
            res = await supabase.from('breeder_store_pages').update(payload).eq('id', page.id).select().single();
        } else {
            res = await supabase.from('breeder_store_pages').insert(payload).select().single();
        }
        if (res.error) {
            const msg = res.error.message?.includes('duplicate') && res.error.message?.includes('slug')
                ? 'That URL slug is already taken. Try another.'
                : res.error.message || 'Save failed';
            toast({ title: 'Could not save', description: msg, variant: 'destructive' });
        } else {
            setPage(res.data);
            setForm((prev) => ({ ...prev, slug: res.data.slug }));
            toast({ title: 'Saved', description: form.is_published ? 'Your store page is live.' : 'Saved as a draft.' });
        }
        setSaving(false);
    };

    const livePath = page?.slug ? `/store/${page.slug}` : null;

    return (
        <section id="breeder-store">
            <Card className="bg-emerald-950/20 border-emerald-900/40 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-emerald-200 flex items-center gap-2">
                        <Store className="w-5 h-5" /> My Store Page
                    </CardTitle>
                    <CardDescription className="text-emerald-300/60">
                        A dedicated public page for your breeding operation, with a custom URL you can share anywhere. Breeder and Enterprise tier perk.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {loading ? (
                        <div className="flex items-center gap-2 text-emerald-300/80 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading your store
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="store-slug" className="text-slate-200">Custom URL</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 text-sm">geckinspect.com/store/</span>
                                    <Input
                                        id="store-slug"
                                        value={form.slug}
                                        onChange={(e) => handle('slug', normalizeSlug(e.target.value))}
                                        placeholder="your-business-name"
                                        className="bg-slate-900/60 border-slate-700"
                                    />
                                </div>
                                <p className="text-xs text-slate-500">Lowercase letters, numbers, and dashes.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="store-title" className="text-slate-200">Title</Label>
                                <Input
                                    id="store-title"
                                    value={form.title}
                                    onChange={(e) => handle('title', e.target.value)}
                                    placeholder="Sunbeam Crested Geckos"
                                    className="bg-slate-900/60 border-slate-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="store-tagline" className="text-slate-200">Tagline</Label>
                                <Input
                                    id="store-tagline"
                                    value={form.tagline}
                                    onChange={(e) => handle('tagline', e.target.value)}
                                    placeholder="Boutique Lilly White and Cappuccino crosses out of Boise, ID"
                                    className="bg-slate-900/60 border-slate-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="store-description" className="text-slate-200">About your store</Label>
                                <Textarea
                                    id="store-description"
                                    value={form.description}
                                    onChange={(e) => handle('description', e.target.value)}
                                    rows={6}
                                    placeholder="Tell visitors about your breeding focus, what's available now, and how shipping or pickup works."
                                    className="bg-slate-900/60 border-slate-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="store-header" className="text-slate-200">Cover photo URL (optional)</Label>
                                <Input
                                    id="store-header"
                                    value={form.header_image_url}
                                    onChange={(e) => handle('header_image_url', e.target.value)}
                                    placeholder="https://..."
                                    className="bg-slate-900/60 border-slate-700"
                                />
                                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                                    <p className="text-xs text-slate-300 font-medium">Banner sizing</p>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        The banner renders full-width across the top of your store page at roughly
                                        <span className="text-slate-300"> 320px tall on desktop</span> and
                                        <span className="text-slate-300"> 224px tall on mobile</span>.
                                        It crops to fit (center-cropped), so the most important part of the photo should sit near the middle.
                                    </p>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        <span className="text-slate-300">Recommended: 1920 × 480 pixels</span> (4:1 ratio). Anything below
                                        <span className="text-slate-300"> 1280 × 320</span> will look soft on larger screens.
                                        Up to 2400 × 600 is fine if you want extra crispness on retina displays.
                                    </p>
                                    {form.header_image_url && (
                                        <ImageDimensionsHint url={form.header_image_url} />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="store-contact" className="text-slate-200">Get-in-touch link</Label>
                                    <Input
                                        id="store-contact"
                                        value={form.contact_link}
                                        onChange={(e) => handle('contact_link', e.target.value)}
                                        placeholder="mailto:you@example.com or https://instagram.com/..."
                                        className="bg-slate-900/60 border-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="store-secondary" className="text-slate-200">External store link (optional)</Label>
                                    <Input
                                        id="store-secondary"
                                        value={form.secondary_link}
                                        onChange={(e) => handle('secondary_link', e.target.value)}
                                        placeholder="https://morphmarket.com/us/c/store/..."
                                        className="bg-slate-900/60 border-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                                <div>
                                    <p className="text-slate-100 font-medium">Publish my store page</p>
                                    <p className="text-xs text-slate-400">When off, only you can preview the page.</p>
                                </div>
                                <Switch checked={form.is_published} onCheckedChange={(v) => handle('is_published', v)} />
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
                                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save store
                                </Button>
                                {livePath && (
                                    <Button asChild variant="outline" className="border-slate-700">
                                        <Link to={livePath} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="w-4 h-4 mr-2" /> Open page
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
