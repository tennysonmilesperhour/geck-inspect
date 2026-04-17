import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { passportUrl } from '@/lib/passportUtils';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check, Printer, ArrowLeft } from 'lucide-react';

const C = {
  forest: '#e2e8f0', moss: '#94a3b8', sage: '#10b981',
  paleSage: 'rgba(16,185,129,0.1)', warmWhite: '#020617', muted: '#64748b', slate: '#cbd5e1',
  cardBg: '#0f172a', border: 'rgba(51,65,85,0.5)',
};

export default function PassportQR() {
  const { passportCode } = useParams();
  const [gecko, setGecko] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);
  const url = passportUrl(passportCode);

  useEffect(() => {
    if (!passportCode) return;
    (async () => {
      const { data } = await supabase
        .from('geckos')
        .select('id, name, morphs_traits, passport_code')
        .eq('passport_code', passportCode)
        .maybeSingle();
      setGecko(data);
      setIsLoading(false);
    })();
  }, [passportCode]);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPNG = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 800);

    // Render QR
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 100, 60, 600, 600);

      // Add text
      ctx.fillStyle = C.forest;
      ctx.font = '600 24px "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gecko?.name || 'Animal Passport', 400, 710);

      ctx.fillStyle = C.muted;
      ctx.font = '16px monospace';
      ctx.fillText(passportCode, 400, 740);

      ctx.font = '12px "DM Sans", sans-serif';
      ctx.fillText('Scan to view full history — Geck Inspect', 400, 775);

      // Download
      const link = document.createElement('a');
      link.download = `${passportCode}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="w-64 h-64 animate-pulse rounded-xl" style={{ backgroundColor: C.paleSage }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          to={`/passport/${passportCode}`}
          className="inline-flex items-center gap-1 text-sm mb-6 transition hover:opacity-70"
          style={{ color: C.sage }}
        >
          <ArrowLeft size={16} /> Back to passport
        </Link>

        {/* Print-optimized QR card */}
        <div
          className="rounded-xl border p-8 text-center print:border-none print:shadow-none print:rounded-none"
          style={{ borderColor: C.border, backgroundColor: C.cardBg }}
          ref={qrRef}
        >
          <QRCodeSVG value={url} size={280} level="M" className="mx-auto mb-6" />

          <h1
            className="text-2xl"
            style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
          >
            {gecko?.name || 'Animal Passport'}
          </h1>

          <p
            className="font-mono text-sm mt-2"
            style={{ color: C.muted }}
          >
            {passportCode}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: C.sage }}>
              <span className="text-white text-xs font-bold">GI</span>
            </div>
            <span className="text-xs font-medium" style={{ color: C.forest }}>
              Scan to view full history
            </span>
          </div>

          <p className="text-xs mt-2" style={{ color: C.muted }}>{url}</p>
        </div>

        {/* Action buttons (hidden during print) */}
        <div className="flex gap-3 mt-6 print:hidden">
          <button
            onClick={downloadPNG}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: C.sage }}
          >
            <Download size={16} /> Download PNG
          </button>
          <button
            onClick={copyLink}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition hover:opacity-90 border"
            style={{ borderColor: C.sage, color: C.sage }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        <button
          onClick={() => window.print()}
          className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition hover:opacity-90 border print:hidden"
          style={{ borderColor: C.paleSage, color: C.muted }}
        >
          <Printer size={16} /> Print QR Sticker
        </button>

        <p className="text-xs text-center mt-4 print:hidden" style={{ color: C.muted }}>
          Print and stick on your enclosure or tub for instant access to this gecko's records.
        </p>
      </div>
    </div>
  );
}
