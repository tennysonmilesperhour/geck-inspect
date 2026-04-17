/**
 * PedigreePosterExport — one-click export of a pedigree tree as a
 * high-res PNG with a "Made with Geck Inspect" watermark.
 *
 * Uses html2canvas (already a dep) to render a hidden pedigree
 * container to a canvas, then triggers a download.
 *
 * Usage:
 *   <PedigreePosterExport
 *     geckoName="Luna"
 *     pedigreeRef={ref}     // ref to the DOM node to capture
 *   />
 */
import { useState } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Download, Image as ImageIcon, Loader2 } from 'lucide-react';

async function captureAndDownload(element, geckoName, setStatus) {
  if (!element) {
    setStatus('error');
    return;
  }

  setStatus('rendering');

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#020617', // slate-950
      scale: 2, // 2x for retina quality
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    // Add watermark
    const ctx = canvas.getContext('2d');
    const padding = 20;
    const fontSize = 14 * 2; // scaled
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(134, 239, 172, 0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(
      'Made with Geck Inspect \u2022 geckinspect.com',
      canvas.width - padding,
      canvas.height - padding
    );

    // Trigger download
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(geckoName || 'gecko').replace(/[^a-zA-Z0-9_-]/g, '_')}_pedigree.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus('done');
    setTimeout(() => setStatus('idle'), 2000);
  } catch (err) {
    console.error('Pedigree export failed:', err);
    setStatus('error');
    setTimeout(() => setStatus('idle'), 3000);
  }
}

export default function PedigreePosterExport({ geckoName, pedigreeRef }) {
  const [status, setStatus] = useState('idle'); // idle | rendering | done | error

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={status === 'rendering'}
      onClick={() => captureAndDownload(pedigreeRef?.current, geckoName, setStatus)}
      className="border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/30"
    >
      {status === 'rendering' ? (
        <>
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          Rendering...
        </>
      ) : status === 'done' ? (
        <>
          <ImageIcon className="w-4 h-4 mr-1.5" />
          Saved!
        </>
      ) : status === 'error' ? (
        'Export failed'
      ) : (
        <>
          <Download className="w-4 h-4 mr-1.5" />
          Export Poster
        </>
      )}
    </Button>
  );
}
