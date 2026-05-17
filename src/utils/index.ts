


export function createPageUrl(pageName: string) {
    // Routes in App.jsx use the exact page key from pages.config.js
    // (e.g. /Membership, /MarketplaceSalesStats). Previous version
    // lowercased the name, which broke routing for multi-word pages.
    return '/' + pageName;
}

type DisplayNameUser = {
    full_name?: string | null;
    breeder_name?: string | null;
    business_name?: string | null;
    email?: string | null;
} | null | undefined;

// Display name shown in the header, greetings, and avatar fallback.
// full_name is the source of truth, but new sign-ups have it defaulted to
// the email address. Mask that case so we don't show a raw email until the
// user has had a chance to set a real name.
export function getDisplayName(user: DisplayNameUser): string {
    if (!user) return 'Geck Inspect User';
    const fullName = (user.full_name || '').trim();
    if (fullName && !fullName.includes('@')) return fullName;
    const breeder = (user.breeder_name || user.business_name || '').trim();
    if (breeder) return breeder;
    const email = (user.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];
    return 'Geck Inspect User';
}