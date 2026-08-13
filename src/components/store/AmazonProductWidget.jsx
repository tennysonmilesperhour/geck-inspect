const TRUSTED_WIDGET_HOSTS = new Set([
  'rcm-na.amazon-adsystem.com',
  'ws-na.amazon-adsystem.com',
  'z-na.amazon-adsystem.com',
]);

function trustedAmazonWidgetUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (!TRUSTED_WIDGET_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function AmazonProductWidget({ product }) {
  const widgetUrl = trustedAmazonWidgetUrl(product?.vendor_extra?.amazon_widget_url);
  if (!widgetUrl) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
      <iframe
        title={`${product.name} Amazon product preview`}
        src={widgetUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full min-h-[220px] border-0 bg-white"
      />
    </div>
  );
}
