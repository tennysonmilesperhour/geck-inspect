import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { passportUrl } from '@/lib/passportUtils';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The downloaded label is drawn on white, so its text needs dark ink
// (the page's own light-on-dark text colors would vanish on paper).
const LABEL_INK = '#0f172a';
const LABEL_MUTED = '#475569';

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
      ctx.fillStyle = LABEL_INK;
      ctx.font = '600 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gecko?.name || 'Animal Passport', 400, 710);

      ctx.fillStyle = LABEL_MUTED;
      ctx.font = '16px monospace';
      ctx.fillText(passportCode, 400, 740);

      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Scan to view full history · Geck Inspect', 400, 775);

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-64 h-64 animate-pulse rounded-xl bg-emerald-500/10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 print:bg-white">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          to={`/passport/${passportCode}`}
          className="touch:min-h-11 inline-flex items-center gap-1 text-sm mb-6 text-emerald-400 hover:text-emerald-300 transition-colors print:hidden"
        >
          <ArrowLeft size={16} /> Back to passport
        </Link>

        {/* Print-optimized QR card */}
        <div
          className="rounded-xl border border-slate-700 bg-slate-900 p-6 md:p-8 text-center print:border-none print:shadow-none print:rounded-none print:bg-white"
          ref={qrRef}
        >
          <QRCodeSVG value={url} size={280} level="M" className="mx-auto mb-6" />

          <h1 className="text-2xl font-bold text-slate-100 print:text-black">
            {gecko?.name || 'Animal Passport'}
          </h1>

          <p className="font-mono text-sm mt-2 text-slate-400 print:text-black">
            {passportCode}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">GI</span>
            </div>
            <span className="text-xs font-medium text-slate-200 print:text-black">
              Scan to view full history
            </span>
          </div>

          <p className="text-xs mt-2 text-slate-500 break-all print:text-black">{url}</p>
        </div>

        {/* Action buttons (hidden during print) */}
        <div className="flex gap-2 mt-6 print:hidden">
          <Button onClick={downloadPNG} className="flex-1 h-11">
            <Download size={16} /> Download PNG
          </Button>
          <Button variant="outline" onClick={copyLink} className="flex-1 h-11">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={() => window.print()}
          className="w-full h-11 mt-2 print:hidden"
        >
          <Printer size={16} /> Print QR Sticker
        </Button>

        <p className="text-xs text-center text-slate-500 mt-4 print:hidden">
          Print and stick on your enclosure or tub for instant access to this gecko's records.
        </p>
      </div>
    </div>
  );
}
