import { useState, useEffect, useRef } from 'react';
import { Share2, Twitter, Facebook, Instagram, Link as LinkIcon, Check, ExternalLink } from 'lucide-react';

/**
 * Share menu for gecko profile pages — public passport (AnimalPassport)
 * and the in-app gecko detail (GeckoDetail).
 *
 * Pops a small panel with direct share targets for X (Twitter Web Intent),
 * Facebook (Sharer), Instagram (which has no web-share API, so we open
 * the app via instagram:// on mobile and otherwise prompt the user to
 * paste the link manually), plus a "Copy link" fallback.
 *
 * If the browser supports navigator.share() we ALSO surface a "More..."
 * option that opens the native OS share sheet — which is the only way
 * to "share to Instagram" cleanly on mobile, since the share sheet
 * includes Instagram alongside every other installed app.
 *
 * Props:
 *   url      — absolute URL to share (required)
 *   title    — short text used as the post copy / window title (required)
 *   subtitle — optional second line (e.g. morph, sex, breeder name)
 *   className — passed through to the trigger button
 */
export default function ShareMenu({ url, title, subtitle, className = '' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const fullText = subtitle ? `${title} — ${subtitle}` : title;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(fullText);

  const xHref = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for older browsers / non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1800); }
      finally { document.body.removeChild(ta); }
    }
  };

  // Instagram has no public share-by-URL API. On mobile the OS share
  // sheet is the right path (handled by the Native Share button below
  // when navigator.share is available). On desktop we copy the link
  // and tell the user to paste it into a Story or post manually.
  const shareToInstagram = async () => {
    await copyLink();
    // Try the deep-link in case we're on iOS/Android with the app
    // installed; this no-ops on desktop browsers.
    try { window.location.href = 'instagram://app'; } catch { /* noop */ }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const nativeShare = async () => {
    try {
      await navigator.share({ title, text: fullText, url });
      setOpen(false);
    } catch {
      // User cancelled or share failed — leave the menu open so they
      // can pick a specific target instead.
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          'inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors ' +
          className
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-md border border-slate-700 bg-slate-900 shadow-xl shadow-black/40 z-50 overflow-hidden"
        >
          {canNativeShare && (
            <button
              type="button"
              onClick={nativeShare}
              role="menuitem"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-100 hover:bg-emerald-500/15 transition-colors"
            >
              <Share2 className="w-4 h-4 text-emerald-300" />
              <span className="flex-1 text-left">More apps…</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </button>
          )}

          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-100 hover:bg-emerald-500/15 transition-colors"
          >
            <Twitter className="w-4 h-4 text-sky-300" />
            <span className="flex-1 text-left">X (Twitter)</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          <a
            href={fbHref}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-100 hover:bg-emerald-500/15 transition-colors"
          >
            <Facebook className="w-4 h-4 text-blue-400" />
            <span className="flex-1 text-left">Facebook</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>

          <button
            type="button"
            onClick={shareToInstagram}
            role="menuitem"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-100 hover:bg-emerald-500/15 transition-colors"
          >
            <Instagram className="w-4 h-4 text-pink-400" />
            <span className="flex-1 text-left">
              Instagram
              <span className="block text-[10px] text-slate-500 leading-tight">Link copied — paste into a story or post</span>
            </span>
          </button>

          <div className="border-t border-slate-800" />

          <button
            type="button"
            onClick={copyLink}
            role="menuitem"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-100 hover:bg-emerald-500/15 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="flex-1 text-left text-emerald-300">Link copied</span>
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 text-slate-300" />
                <span className="flex-1 text-left">Copy link</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
