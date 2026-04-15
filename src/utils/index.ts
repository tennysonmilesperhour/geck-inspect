


export function createPageUrl(pageName: string) {
    // Routes in App.jsx use the exact page key from pages.config.js
    // (e.g. /Membership, /MarketplaceSalesStats). Previous version
    // lowercased the name, which broke routing for multi-word pages.
    return '/' + pageName;
}